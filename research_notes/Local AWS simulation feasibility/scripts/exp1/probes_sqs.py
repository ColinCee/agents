"""SQS accuracy probes. Usage: probes_sqs.py <label> <endpoint|aws>  -> probes_sqs_<label>.json
Rerunnable against real AWS (endpoint 'aws'); creates queues prefixed prsqs-. Takes ~1-2 min because of real waits (visibility, dedup, DLQ)."""
import sys, json, uuid, time
from botocore.exceptions import ClientError
from common import client
label, ep = sys.argv[1:3]
c = client("sqs", ep)
R = {}
def err(fn):
    try: r = fn(); return {"ok": True, "resp": {k: v for k, v in r.items() if k != "ResponseMetadata"}}
    except ClientError as e: return {"ok": False, "code": e.response["Error"]["Code"], "msg": e.response["Error"]["Message"][:200], "http": e.response["ResponseMetadata"]["HTTPStatusCode"]}
    except Exception as e: return {"ok": False, "code": type(e).__name__, "msg": str(e)[:200]}
def rec(pid, expect, obs, match): R[pid] = {"expect": expect, "observed": obs, "match": match}
def q(name="", fifo=False, attrs=None):
    n = "prsqs-" + name + uuid.uuid4().hex[:5] + (".fifo" if fifo else "")
    a = dict(attrs or {}); 
    if fifo: a["FifoQueue"] = "true"
    return c.create_queue(QueueName=n, Attributes=a)["QueueUrl"]
def recv(u, **kw): return c.receive_message(QueueUrl=u, AttributeNames=["All"], MessageAttributeNames=["All"], **kw).get("Messages", [])

# S01 visibility timeout redelivery + ApproximateReceiveCount
u = q("vt"); c.send_message(QueueUrl=u, MessageBody="m")
m1 = recv(u, VisibilityTimeout=2); m1b = recv(u); time.sleep(2.6); m2 = recv(u)
rec("S01_visibility_redelivery", "1st receive count=1; hidden during timeout (0 msgs); redelivered after 2s with ApproximateReceiveCount=2",
    {"first": len(m1), "c1": m1[0]["Attributes"].get("ApproximateReceiveCount") if m1 else None, "during": len(m1b), "after": len(m2), "c2": m2[0]["Attributes"].get("ApproximateReceiveCount") if m2 else None},
    len(m1) == 1 and len(m1b) == 0 and len(m2) == 1 and m2[0]["Attributes"].get("ApproximateReceiveCount") == "2")

# S02 FIFO dedup within 5 minutes (explicit dedup id)
u = q("dd", fifo=True)
a = c.send_message(QueueUrl=u, MessageBody="a", MessageGroupId="g", MessageDeduplicationId="d1")
b = c.send_message(QueueUrl=u, MessageBody="a", MessageGroupId="g", MessageDeduplicationId="d1")
ms = recv(u, MaxNumberOfMessages=10)
rec("S02_fifo_dedup", "second send accepted but same MessageId, only 1 message deliverable", {"same_id": a["MessageId"] == b["MessageId"], "delivered": len(ms)}, len(ms) == 1)  # same_id reported but not scored: docs say only that the duplicate is accepted and not delivered
# S02b content-based dedup
u = q("cb", fifo=True, attrs={"ContentBasedDeduplication": "true"})
c.send_message(QueueUrl=u, MessageBody="same", MessageGroupId="g"); c.send_message(QueueUrl=u, MessageBody="same", MessageGroupId="g")
ms = recv(u, MaxNumberOfMessages=10)
rec("S02b_fifo_content_dedup", "1 message delivered", len(ms), len(ms) == 1)
# S02c FIFO send w/o group id
o = err(lambda: c.send_message(QueueUrl=u, MessageBody="x"))
rec("S02c_fifo_missing_group_id", "error MissingParameter / InvalidParameterValue", o, not o["ok"])
# S02d dedup expiry cannot be tested within budget (5 min); documented only.

# S03 size limits. Sizes: 256KiB, 256KiB+1, 1MiB, 1MiB+1
u = q("sz")
sizes = {"256KiB": 262144, "256KiB+1": 262145, "1MiB": 1048576, "1MiB+1": 1048577}
obs = {k: ("ok" if err(lambda n=n: c.send_message(QueueUrl=u, MessageBody="x" * n))["ok"] else err(lambda n=n: c.send_message(QueueUrl=u, MessageBody="x" * n)).get("code")) for k, n in sizes.items()}
exp_1mib = {"256KiB": "ok", "256KiB+1": "ok", "1MiB": "ok", "1MiB+1": "rejected"}  # post-Aug-2025 AWS limit 1 MiB
rec("S03_message_size_limit", "AWS since Aug 2025: 1 MiB accepted, 1MiB+1 rejected (pre-2025: 256KiB+1 rejected)", obs,
    obs["256KiB"] == "ok" and obs["256KiB+1"] == "ok" and obs["1MiB"] == "ok" and obs["1MiB+1"] != "ok")
at = c.get_queue_attributes(QueueUrl=u, AttributeNames=["MaximumMessageSize"])["Attributes"]
rec("S03b_default_MaximumMessageSize_attr", "1048576 (new default) ", at, at.get("MaximumMessageSize") == "1048576")

# S04 DLQ redrive
dlq = q("dlq"); arn = c.get_queue_attributes(QueueUrl=dlq, AttributeNames=["QueueArn"])["Attributes"]["QueueArn"]
u = q("src", attrs={"RedrivePolicy": json.dumps({"deadLetterTargetArn": arn, "maxReceiveCount": "2"}), "VisibilityTimeout": "1"})
c.send_message(QueueUrl=u, MessageBody="poison")
n_recv = 0
for _ in range(3):
    got = recv(u, WaitTimeSeconds=0)
    n_recv += len(got); time.sleep(1.6)
final_src = recv(u); time.sleep(0.5)
in_dlq = recv(dlq, WaitTimeSeconds=2)
rec("S04_dlq_after_maxReceiveCount", "message received 2x from source then moved to DLQ (not delivered 3rd time)", {"src_receives": n_recv, "src_after": len(final_src), "dlq": len(in_dlq)}, n_recv == 2 and len(final_src) == 0 and len(in_dlq) == 1)
rec("S04b_dlq_receive_count_attr", "INFORMATIONAL (no doc statement found): receive count on DLQ copy", in_dlq[0]["Attributes"].get("ApproximateReceiveCount") if in_dlq else None, None)

# S05 delay
u = q("dl"); c.send_message(QueueUrl=u, MessageBody="d", DelaySeconds=2)
now = len(recv(u)); time.sleep(2.5); later = len(recv(u))
rec("S05_delay_seconds", "0 immediately, 1 after delay", {"now": now, "later": later}, now == 0 and later == 1)

# S06 long polling duration on empty queue
u = q("lp"); t0 = time.time(); recv(u, WaitTimeSeconds=2); dt = time.time() - t0
rec("S06_long_poll_wait", "returns after ~2s when empty", round(dt, 2), 1.8 < dt < 3.0)

# S07 batch >10
u = q("bt")
o = err(lambda: c.send_message_batch(QueueUrl=u, Entries=[{"Id": str(i), "MessageBody": "x"} for i in range(11)]))
rec("S07_batch_11_entries", "TooManyEntriesInBatchRequest (AWS.SimpleQueueService.TooManyEntriesInBatchRequest in query protocol)", o, not o["ok"] and "TooManyEntries" in str(o.get("code")))
# S08 max number of messages 11
o = err(lambda: c.receive_message(QueueUrl=u, MaxNumberOfMessages=11))
rec("S08_receive_max_11", "InvalidParameterValue (1..10)", o, not o["ok"] and "InvalidParameterValue" in str(o.get("code")))
# S09 nonexistent queue
o = err(lambda: c.get_queue_url(QueueName="prsqs-does-not-exist-zz"))
rec("S09_nonexistent_queue", "QueueDoesNotExist (JSON protocol; legacy AWS.SimpleQueueService.NonExistentQueue)", o, not o["ok"] and "NonExistentQueue" in str(o.get("code")) + str(o.get("msg")) if False else (not o["ok"] and o.get("code") in ("QueueDoesNotExist", "AWS.SimpleQueueService.NonExistentQueue")))
# S10 FIFO ordering & group blocking
u = q("fo", fifo=True)
for i in range(3): c.send_message(QueueUrl=u, MessageBody=f"a{i}", MessageGroupId="A", MessageDeduplicationId=f"a{i}")
c.send_message(QueueUrl=u, MessageBody="b0", MessageGroupId="B", MessageDeduplicationId="b0")
g1 = recv(u, MaxNumberOfMessages=10, VisibilityTimeout=30)
bodies = [m["Body"] for m in g1]
rec("S10_fifo_group_inflight_blocking", "single receive returns a0,a1,a2 (+b0) in order per group; a second receive returns nothing for group A while in flight", {"first": bodies, "second": [m["Body"] for m in recv(u, MaxNumberOfMessages=10)]},
    [b for b in bodies if b.startswith("a")] == ["a0", "a1", "a2"] and not [m for m in recv(u, MaxNumberOfMessages=10) if m["Body"].startswith("a")])
# S11 message attributes MD5
o = err(lambda: c.send_message(QueueUrl=u, MessageBody="hello", MessageGroupId="C", MessageDeduplicationId="c1", MessageAttributes={"k": {"DataType": "String", "StringValue": "v"}}))
rec("S11_md5_of_body_and_attrs", "MD5OfMessageBody=5d41402abc4b2a76b9719d911017c592 and MD5OfMessageAttributes present", {"body": o["resp"].get("MD5OfMessageBody"), "attrs": o["resp"].get("MD5OfMessageAttributes")}, o["ok"] and o["resp"].get("MD5OfMessageBody") == "5d41402abc4b2a76b9719d911017c592" and bool(o["resp"].get("MD5OfMessageAttributes")))
# S12 change visibility & delete with stale receipt handle
u = q("cv"); c.send_message(QueueUrl=u, MessageBody="v")
m = recv(u, VisibilityTimeout=1)[0]; time.sleep(1.5); m2l = recv(u, VisibilityTimeout=30)
rec("S12a_redelivery_after_1s_vt", "message redelivered after 1s visibility timeout expires (1.5s wait)", len(m2l), len(m2l) == 1)
o = err(lambda: c.delete_message(QueueUrl=u, ReceiptHandle=m["ReceiptHandle"]))
rec("S12_delete_with_stale_receipt_handle", "AWS: no error is returned for delete with an old handle (message may or may not be deleted; if it is in flight with a newer handle it is NOT deleted)", {"stale_delete": o, "redelivered": len(m2l)}, o["ok"])
# S13 invalid FIFO name
o = err(lambda: c.create_queue(QueueName="prsqs-bad" + uuid.uuid4().hex[:4], Attributes={"FifoQueue": "true"}))
rec("S13_fifo_name_without_suffix", "InvalidParameterValue (FIFO queue name must end in .fifo)", o, not o["ok"])
# S14 purge
u = q("pg"); c.send_message(QueueUrl=u, MessageBody="1"); c.purge_queue(QueueUrl=u); 
rec("S14_purge", "empty after purge", len(recv(u)), len(recv(u)) == 0)
json.dump({label: R}, open(f"probes_sqs_{label}.json", "w"), indent=1, default=str)
print(label, sum(bool(v["match"]) for v in R.values()), "/", len([1 for v in R.values() if v["match"] is not None]), "match")
for k, v in R.items():
    if v["match"] is False: print("  DIFF", k, "->", json.dumps(v["observed"], default=str)[:260])
