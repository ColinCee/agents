"""Shared helpers. Endpoints configurable via env so the same scripts can run against real AWS:
   DDB_ENDPOINT / SQS_ENDPOINT / LAMBDA_ENDPOINT  (set to 'aws' or empty to use real AWS; creds from env/profile)
   TARGET label is only for output naming."""
import os, time, statistics, boto3
from botocore.config import Config
def client(svc, endpoint):
    kw = dict(region_name=os.environ.get("AWS_REGION","us-east-1"),
              config=Config(retries={"max_attempts":1}, read_timeout=int(os.environ.get("READ_TIMEOUT","120"))))
    if endpoint and endpoint != "aws":
        kw.update(endpoint_url=endpoint, aws_access_key_id="test", aws_secret_access_key="test")
    return boto3.client(svc, **kw)
def stats(lat):
    lat = sorted(lat); n = len(lat)
    return dict(n=n, p50_ms=round(lat[n//2]*1e3,3), p99_ms=round(lat[min(n-1,int(n*.99))]*1e3,3),
                mean_ms=round(statistics.mean(lat)*1e3,3), ops_per_s=round(n/sum(lat),1))
def timed(fn, n):
    out=[]
    for i in range(n):
        t=time.perf_counter(); fn(i); out.append(time.perf_counter()-t)
    return out
