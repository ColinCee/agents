import time,json,os,subprocess,sys
t0=time.perf_counter()
os.environ.update(AWS_ACCESS_KEY_ID="t",AWS_SECRET_ACCESS_KEY="t",AWS_DEFAULT_REGION="us-east-1")
import boto3
from moto import mock_aws
t_imp=time.perf_counter()-t0
with mock_aws():
    ev=boto3.client("events");sqs=boto3.client("sqs")
    q=sqs.create_queue(QueueName="q")["QueueUrl"];arn=sqs.get_queue_attributes(QueueUrl=q,AttributeNames=["QueueArn"])["Attributes"]["QueueArn"]
    ev.put_rule(Name="r",EventPattern=json.dumps({"source":["app"]}));ev.put_targets(Rule="r",Targets=[{"Id":"1","Arn":arn}])
    ev.put_events(Entries=[{"Source":"app","DetailType":"x","Detail":"{}"}]);sqs.receive_message(QueueUrl=q)
    print(f"moto in-process: import+setup+first event delivered = {(time.perf_counter()-t0)*1000:.0f} ms (import alone {t_imp*1000:.0f} ms)")
    lat=[]
    for i in range(1000):
        s=time.perf_counter();ev.put_events(Entries=[{"Source":"app","DetailType":"x","Detail":"{}"}]);m=sqs.receive_message(QueueUrl=q).get("Messages");lat.append(time.perf_counter()-s)
    lat.sort();print(f"moto in-process put_events+receive via boto3 (N=1000): p50={lat[500]*1000:.2f} ms p99={lat[990]*1000:.2f} ms")
