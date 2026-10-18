"""SQS with queue depth ~0: per iteration send 1, receive 1, delete 1; reports each op latency. Usage: bench_sqs_shallow.py <label> <endpoint> [N]"""
import sys, json, time, uuid
from common import client, stats
label, ep = sys.argv[1:3]; N = int(sys.argv[3]) if len(sys.argv) > 3 else 500
c = client("sqs", ep); q = c.create_queue(QueueName="sh-" + uuid.uuid4().hex[:6])["QueueUrl"]
S, Rv, D = [], [], []
for i in range(N + 20):
    t = time.perf_counter(); c.send_message(QueueUrl=q, MessageBody="x" * 100); a = time.perf_counter()
    m = c.receive_message(QueueUrl=q)["Messages"][0]; b = time.perf_counter()
    c.delete_message(QueueUrl=q, ReceiptHandle=m["ReceiptHandle"]); d = time.perf_counter()
    if i >= 20: S.append(a - t); Rv.append(b - a); D.append(d - b)
print(json.dumps({label: {"send": stats(S), "receive": stats(Rv), "delete": stats(D)}}))
