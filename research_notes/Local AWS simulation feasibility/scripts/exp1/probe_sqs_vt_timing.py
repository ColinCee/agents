"""Visibility-timeout expiry precision: receive with VT=v, then poll every 50ms for redelivery; report observed delay (s). AWS expectation: ~v (docs: invisible for the timeout)."""
import sys, time, uuid, json
from common import client
label, ep = sys.argv[1:3]; c = client("sqs", ep); out = {}
for v in (1, 2):
    ds = []
    for _ in range(4):
        u = c.create_queue(QueueName="prvt-" + uuid.uuid4().hex[:6])["QueueUrl"]; c.send_message(QueueUrl=u, MessageBody="x")
        c.receive_message(QueueUrl=u, VisibilityTimeout=v); t0 = time.time(); d = None
        while time.time() - t0 < v + 6:
            if c.receive_message(QueueUrl=u, VisibilityTimeout=30).get("Messages"): d = round(time.time() - t0, 2); break
            time.sleep(0.05)
        ds.append(d); c.delete_queue(QueueUrl=u)
    out[f"VT={v}s"] = ds
print(label, json.dumps(out))
