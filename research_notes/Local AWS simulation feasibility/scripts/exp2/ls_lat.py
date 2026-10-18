import boto3,time,json
kw=dict(endpoint_url="http://localhost:4566",aws_access_key_id="t",aws_secret_access_key="t",region_name="us-east-1")
ev=boto3.client("events",**kw);sqs=boto3.client("sqs",**kw)
q=sqs.create_queue(QueueName="latq")["QueueUrl"];arn=sqs.get_queue_attributes(QueueUrl=q,AttributeNames=["QueueArn"])["Attributes"]["QueueArn"]
ev.put_rule(Name="latr",EventPattern=json.dumps({"source":["app"]}));ev.put_targets(Rule="latr",Targets=[{"Id":"1","Arn":arn}])
lat=[];miss=0
for i in range(200):
    s=time.perf_counter();ev.put_events(Entries=[{"Source":"app","DetailType":"x","Detail":"{}"}])
    while True:
        m=sqs.receive_message(QueueUrl=q,WaitTimeSeconds=1).get("Messages")
        if m: sqs.delete_message(QueueUrl=q,ReceiptHandle=m[0]["ReceiptHandle"]);break
    lat.append(time.perf_counter()-s)
lat.sort();print(f"LocalStack put_events -> visible via receive_message (N=200): p50={lat[100]*1000:.1f} ms p99={lat[197]*1000:.1f} ms")
