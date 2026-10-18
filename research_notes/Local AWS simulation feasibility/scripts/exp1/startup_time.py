"""Measure cold start: spawn process -> first successful API call. Usage: startup_time.py <name> <port> <service> -- cmd...
service: ddb|sqs|s3ready(any HTTP)  Run N times."""
import sys, time, subprocess, os, signal, boto3, botocore
from botocore.config import Config
name, port, svc = sys.argv[1:4]; cmd = sys.argv[5:]
N = int(os.environ.get("N", 3))
res = []
for i in range(N):
    t0 = time.perf_counter()
    p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, preexec_fn=os.setsid)
    c = boto3.client(svc, endpoint_url=f"http://127.0.0.1:{port}", region_name="us-east-1",
        aws_access_key_id="x", aws_secret_access_key="x", config=Config(retries={"max_attempts":1}, connect_timeout=1, read_timeout=2))
    while True:
        try:
            c.list_tables() if svc=="dynamodb" else c.list_queues(); break
        except Exception: 
            if time.perf_counter()-t0>120: print("TIMEOUT"); break
            time.sleep(0.02)
    res.append(time.perf_counter()-t0)
    os.killpg(p.pid, signal.SIGKILL); p.wait(); time.sleep(1)
print(name, "startup_s", [round(r,2) for r in res])
