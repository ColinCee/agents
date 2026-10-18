import boto3,json,io,zipfile,time
kw=dict(endpoint_url="http://localhost:4566",aws_access_key_id="t",aws_secret_access_key="t",region_name="us-east-1")
lam=boto3.client("lambda",**kw);sqs=boto3.client("sqs",**kw)
b=io.BytesIO()
with zipfile.ZipFile(b,"w") as z: z.writestr("h.py","def handler(e,c): return {}")
try:
    lam.create_function(FunctionName="f",Runtime="python3.12",Role="arn:aws:iam::000000000000:role/r",Handler="h.handler",Code={"ZipFile":b.getvalue()})
    for _ in range(20):
        st=lam.get_function(FunctionName="f")["Configuration"]
        if st["State"]!="Pending":break
        time.sleep(1)
    print("function state:",st["State"],st.get("StateReason"))
    q=sqs.create_queue(QueueName="eq")["QueueUrl"];arn=sqs.get_queue_attributes(QueueUrl=q,AttributeNames=["QueueArn"])["Attributes"]["QueueArn"]
    r=lam.create_event_source_mapping(EventSourceArn=arn,FunctionName="f",BatchSize=10,FunctionResponseTypes=["ReportBatchItemFailures"])
    print("ESM created:",r["State"],r["BatchSize"],r.get("FunctionResponseTypes"))
except Exception as e: print("ERR",repr(e)[:300])
