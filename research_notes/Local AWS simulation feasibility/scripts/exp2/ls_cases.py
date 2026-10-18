# Same e2e as moto_cases.py but against a running LocalStack at :4566
import json,os,time,boto3
kw=dict(endpoint_url="http://localhost:4566",aws_access_key_id="t",aws_secret_access_key="t",region_name="us-east-1")
ev=boto3.client("events",**kw);sqs=boto3.client("sqs",**kw)
cases=json.load(open("cases.json"));out={}
for i,c in enumerate(cases):
    try:
        q=sqs.create_queue(QueueName=f"q{i}")["QueueUrl"]
        arn=sqs.get_queue_attributes(QueueUrl=q,AttributeNames=["QueueArn"])["Attributes"]["QueueArn"]
        ev.put_rule(Name=f"r{i}",EventPattern=json.dumps({"detail":c["pattern"]}))
        ev.put_targets(Rule=f"r{i}",Targets=[{"Id":"1","Arn":arn}])
        ev.put_events(Entries=[{"Source":"s","DetailType":"x","Detail":json.dumps(c["event"])}])
        got=False
        for _ in range(3):
            m=sqs.receive_message(QueueUrl=q,WaitTimeSeconds=1).get("Messages")
            if m: got=True;break
        out[c["id"]]=str(got).lower()
        ev.remove_targets(Rule=f"r{i}",Ids=["1"]);ev.delete_rule(Name=f"r{i}")
    except Exception as e:
        out[c["id"]]="ERR:"+type(e).__name__+":"+str(e)[:100]
json.dump(out,open("localstack_out.json","w"),indent=1)
