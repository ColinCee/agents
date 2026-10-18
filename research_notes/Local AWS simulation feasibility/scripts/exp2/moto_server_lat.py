import boto3,time,json
kw=dict(endpoint_url="http://localhost:5555",aws_access_key_id="t",aws_secret_access_key="t",region_name="us-east-1")
ev=boto3.client("events",**kw);sqs=boto3.client("sqs",**kw)
q=sqs.create_queue(QueueName="q")["QueueUrl"];arn=sqs.get_queue_attributes(QueueUrl=q,AttributeNames=["QueueArn"])["Attributes"]["QueueArn"]
ev.put_rule(Name="r",EventPattern=json.dumps({"source":["app"]}));ev.put_targets(Rule="r",Targets=[{"Id":"1","Arn":arn}])
lat=[]
for i in range(300):
    s=time.perf_counter();ev.put_events(Entries=[{"Source":"app","DetailType":"x","Detail":"{}"}]);sqs.receive_message(QueueUrl=q);lat.append(time.perf_counter()-s)
lat.sort();print(f"moto_server (HTTP) put_events+receive (N=300): p50={lat[150]*1000:.2f} ms p99={lat[297]*1000:.2f} ms")
