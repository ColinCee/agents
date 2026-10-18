# Runs each case through Moto EventBridge end-to-end: put_rule(pattern under "detail") -> SQS target -> put_events(Detail=event)
import json,os,time
os.environ.update(AWS_ACCESS_KEY_ID="t",AWS_SECRET_ACCESS_KEY="t",AWS_DEFAULT_REGION="us-east-1")
import boto3
from moto import mock_aws
cases=json.load(open("cases.json"))
out={}
with mock_aws():
    ev=boto3.client("events");sqs=boto3.client("sqs")
    for i,c in enumerate(cases):
        try:
            q=sqs.create_queue(QueueName=f"q{i}")["QueueUrl"]
            arn=sqs.get_queue_attributes(QueueUrl=q,AttributeNames=["QueueArn"])["Attributes"]["QueueArn"]
            ev.put_rule(Name=f"r{i}",EventPattern=json.dumps({"detail":c["pattern"]}))
            ev.put_targets(Rule=f"r{i}",Targets=[{"Id":"1","Arn":arn}])
            ev.put_events(Entries=[{"Source":"s","DetailType":"x","Detail":json.dumps(c["event"])}])
            n=int(sqs.get_queue_attributes(QueueUrl=q,AttributeNames=["ApproximateNumberOfMessages"])["Attributes"]["ApproximateNumberOfMessages"])
            out[c["id"]]=str(n>0).lower()
            ev.remove_targets(Rule=f"r{i}",Ids=["1"]);ev.delete_rule(Name=f"r{i}")
        except Exception as e:
            out[c["id"]]="ERR:"+type(e).__name__+":"+str(e)[:100]
json.dump(out,open("moto_out.json","w"),indent=1)
