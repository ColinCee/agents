# Moto event-source-mapping experiments. Lambda execution needs Docker (absent), so LambdaBackend.invoke is
# replaced by a recorder; everything upstream of it (SQS/DDB-stream -> ESM dispatch) is Moto's real code.
import json,os,time,zipfile,io
os.environ.update(AWS_ACCESS_KEY_ID="t",AWS_SECRET_ACCESS_KEY="t",AWS_DEFAULT_REGION="us-east-1")
import boto3
from moto import mock_aws
from moto.awslambda.models import LambdaBackend
calls=[]; MODE={"m":"ok"}
def fake_invoke(self,function_name,qualifier,body,headers,response_headers):
    ev=json.loads(body); calls.append(ev)
    if MODE["m"]=="fail": response_headers["x-amz-function-error"]="Unhandled"; return b'{"errorMessage":"boom"}'
    if MODE["m"]=="partial":  # AWS contract: function returns batchItemFailures, no function error
        ids=[r["messageId"] for r in ev["Records"]][:1]
        return json.dumps({"batchItemFailures":[{"itemIdentifier":i} for i in ids]}).encode()
    return b"{}"
LambdaBackend.invoke=fake_invoke
from moto.awslambda.models import LambdaFunction
def fake_fn_invoke(self,body,request_headers,response_headers):
    return fake_invoke(None,self.function_name,None,body,request_headers,response_headers)
LambdaFunction.invoke=fake_fn_invoke
def zipb():
    b=io.BytesIO()
    with zipfile.ZipFile(b,"w") as z: z.writestr("h.py","def handler(e,c): return {}")
    return b.getvalue()
R={}
with mock_aws():
    sqs=boto3.client("sqs");lam=boto3.client("lambda");ddb=boto3.client("dynamodb");iam=boto3.client("iam")
    role=iam.create_role(RoleName="r",AssumeRolePolicyDocument="{}")["Role"]["Arn"]
    lam.create_function(FunctionName="f",Runtime="python3.12",Role=role,Handler="h.handler",Code={"ZipFile":zipb()})
    farn=lam.get_function(FunctionName="f")["Configuration"]["FunctionArn"]
    def mkq(n,**a):
        u=sqs.create_queue(QueueName=n,Attributes=a)["QueueUrl"]
        return u,sqs.get_queue_attributes(QueueUrl=u,AttributeNames=["QueueArn"])["Attributes"]["QueueArn"]
    # A: batching
    qu,qa=mkq("qa"); lam.create_event_source_mapping(EventSourceArn=qa,FunctionName="f",BatchSize=10,MaximumBatchingWindowInSeconds=5)
    calls.clear()
    for i in range(25): sqs.send_message(QueueUrl=qu,MessageBody=f"m{i}")
    time.sleep(0.5)
    R["A_batching"]=dict(sent=25,batch_size=10,invocations=len(calls),records_per_invocation=sorted({len(c["Records"]) for c in calls}),
        queue_msgs_left=sqs.get_queue_attributes(QueueUrl=qu,AttributeNames=["ApproximateNumberOfMessages"])["Attributes"]["ApproximateNumberOfMessages"])
    A=calls[0]["Records"][0]; R["A_record_fields"]=dict(ApproximateReceiveCount=A["attributes"]["ApproximateReceiveCount"],md5OfBody=A["md5OfBody"],hardcoded_SentTimestamp=A["attributes"]["SentTimestamp"],messageAttributes=A["messageAttributes"])
    # B: failure -> retry
    qu,qa=mkq("qb",VisibilityTimeout="1"); lam.create_event_source_mapping(EventSourceArn=qa,FunctionName="f",BatchSize=5)
    calls.clear(); MODE["m"]="fail"
    sqs.send_message(QueueUrl=qu,MessageBody="x"); time.sleep(3)
    n_after_wait=len(calls)
    left=sqs.get_queue_attributes(QueueUrl=qu,AttributeNames=["ApproximateNumberOfMessages"])["Attributes"]["ApproximateNumberOfMessages"]
    R["B_failure_retry"]=dict(invocations_after_3s_idle=n_after_wait,msgs_left=left,note="AWS would keep redelivering after visibility timeout; Moto only dispatches on send")
    # C: partial batch response
    MODE["m"]="partial"; qu,qa=mkq("qc"); lam.create_event_source_mapping(EventSourceArn=qa,FunctionName="f",BatchSize=10,FunctionResponseTypes=["ReportBatchItemFailures"])
    calls.clear(); sqs.send_message(QueueUrl=qu,MessageBody="p1")
    R["C_partial_batch"]=dict(invocations=len(calls),msgs_left_visible=sqs.get_queue_attributes(QueueUrl=qu,AttributeNames=["ApproximateNumberOfMessages"])["Attributes"]["ApproximateNumberOfMessages"],
        note="function reported its only message as failed; AWS would retain it")
    # D: DLQ maxReceiveCount
    MODE["m"]="fail"; dq,da=mkq("dlq"); qu,qa=mkq("qd",VisibilityTimeout="0",RedrivePolicy=json.dumps({"deadLetterTargetArn":da,"maxReceiveCount":"2"}))
    lam.create_event_source_mapping(EventSourceArn=qa,FunctionName="f",BatchSize=1)
    calls.clear(); sqs.send_message(QueueUrl=qu,MessageBody="poison")
    time.sleep(1)
    st1=dict(invocations=len(calls),dlq=sqs.get_queue_attributes(QueueUrl=dq,AttributeNames=["ApproximateNumberOfMessages"])["Attributes"]["ApproximateNumberOfMessages"])
    for _ in range(4): 
        sqs.receive_message(QueueUrl=qu,MaxNumberOfMessages=1)  # manual receives bump ReceiveCount
    time.sleep(0.2)
    st2=dict(invocations=len(calls),dlq=sqs.get_queue_attributes(QueueUrl=dq,AttributeNames=["ApproximateNumberOfMessages"])["Attributes"]["ApproximateNumberOfMessages"])
    R["D_dlq"]=dict(after_send=st1,after_manual_receives=st2)
    # E: DynamoDB Streams
    ddb.create_table(TableName="t",KeySchema=[{"AttributeName":"id","KeyType":"HASH"}],AttributeDefinitions=[{"AttributeName":"id","AttributeType":"S"}],BillingMode="PAY_PER_REQUEST",StreamSpecification={"StreamEnabled":True,"StreamViewType":"NEW_AND_OLD_IMAGES"})
    sarn=ddb.describe_table(TableName="t")["Table"]["LatestStreamArn"]
    MODE["m"]="ok"
    try:
        lam.create_event_source_mapping(EventSourceArn=sarn,FunctionName="f",BatchSize=100,StartingPosition="TRIM_HORIZON",BisectBatchOnFunctionError=True,MaximumRetryAttempts=1)
        calls.clear()
        for i in range(5): ddb.put_item(TableName="t",Item={"id":{"S":str(i)}})
        ddb.update_item(TableName="t",Key={"id":{"S":"0"}},UpdateExpression="SET a=:v",ExpressionAttributeValues={":v":{"S":"1"}})
        ddb.delete_item(TableName="t",Key={"id":{"S":"1"}})
        R["E_ddb"]=dict(writes=7,invocations=len(calls),records_per_invocation=[len(c["Records"]) for c in calls],events=[r["eventName"] for c in calls for r in c["Records"]][:12])
        MODE["m"]="fail"; calls.clear(); ddb.put_item(TableName="t",Item={"id":{"S":"z"}}); time.sleep(0.5)
        R["E_ddb_fail"]=dict(invocations_after_failing_write=len(calls),note="no retry/bisect/DLQ logic observed" )
    except Exception as e: R["E_ddb"]="ERR "+repr(e)[:200]
print(json.dumps(R,indent=1))
json.dump(R,open("moto_esm_out.json","w"),indent=1)
