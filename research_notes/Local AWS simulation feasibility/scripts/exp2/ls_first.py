import boto3,time,json
t0=time.perf_counter()
kw=dict(endpoint_url="http://localhost:4566",aws_access_key_id="t",aws_secret_access_key="t",region_name="us-east-1")
ev=boto3.client("events",**kw);sqs=boto3.client("sqs",**kw)
q=sqs.create_queue(QueueName="fq")["QueueUrl"];arn=sqs.get_queue_attributes(QueueUrl=q,AttributeNames=["QueueArn"])["Attributes"]["QueueArn"]
ev.put_rule(Name="fr",EventPattern=json.dumps({"source":["app"]}));ev.put_targets(Rule="fr",Targets=[{"Id":"1","Arn":arn}])
ev.put_events(Entries=[{"Source":"app","DetailType":"x","Detail":"{}"}])
while not sqs.receive_message(QueueUrl=q,WaitTimeSeconds=1).get("Messages"): pass
print(f"LocalStack first-use (create queue+rule+first event delivered) = {(time.perf_counter()-t0)*1000:.0f} ms after health OK")
