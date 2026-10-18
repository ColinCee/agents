"""Latency bench: sequential single-client ops, boto3 over HTTP. Usage: bench.py <label> <ddb|sqs|lambda> <endpoint> [N]"""
import os, sys, json, uuid, io, zipfile, time
from common import *
label, svc, ep = sys.argv[1:4]; N = int(sys.argv[4]) if len(sys.argv)>4 else 1000
res = {}
if svc=="ddb":
    c = client("dynamodb", ep); t="bench_"+uuid.uuid4().hex[:6]
    c.create_table(TableName=t, KeySchema=[{"AttributeName":"pk","KeyType":"HASH"}],
        AttributeDefinitions=[{"AttributeName":"pk","AttributeType":"S"}], BillingMode="PAY_PER_REQUEST")
    c.get_waiter("table_exists").wait(TableName=t)
    for i in range(50): c.put_item(TableName=t, Item={"pk":{"S":f"w{i}"}})  # warmup
    res["PutItem"]=stats(timed(lambda i: c.put_item(TableName=t, Item={"pk":{"S":f"k{i}"},"v":{"S":"x"*100}}), N))
    res["GetItem"]=stats(timed(lambda i: c.get_item(TableName=t, Key={"pk":{"S":f"k{i}"}}), N))
elif svc=="sqs":
    c = client("sqs", ep); q=c.create_queue(QueueName="bench-"+uuid.uuid4().hex[:6])["QueueUrl"]
    for i in range(50): c.send_message(QueueUrl=q, MessageBody="w")
    while c.receive_message(QueueUrl=q, MaxNumberOfMessages=10).get("Messages"): pass
    c.purge_queue(QueueUrl=q) if False else None
    res["SendMessage"]=stats(timed(lambda i: c.send_message(QueueUrl=q, MessageBody="x"*100), N))
    # drain leftovers then receive+delete the N messages
    def rd(i):
        m=c.receive_message(QueueUrl=q, MaxNumberOfMessages=1, WaitTimeSeconds=0).get("Messages")
        if m: c.delete_message(QueueUrl=q, ReceiptHandle=m[0]["ReceiptHandle"])
    res["Receive+Delete(1 msg)"]=stats(timed(rd, N))
elif svc=="lambda":
    c = client("lambda", ep); fn="bench-"+uuid.uuid4().hex[:6]
    b=io.BytesIO(); z=zipfile.ZipFile(b,"w"); z.writestr("h.py","def handler(e,c):\n    return {'ok':True,'e':e}\n"); z.close()
    if os.environ.get("LAMBDA_CREATE_ROLE"):  # emulators: make an assumable role (moto validates it); skip on real AWS
        import json as j; iam=client("iam", os.environ.get("IAM_ENDPOINT", ep))
        r=iam.create_role(RoleName="r"+fn, AssumeRolePolicyDocument=j.dumps({"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}))
        os.environ["LAMBDA_ROLE"]=r["Role"]["Arn"]
    t0=time.perf_counter()
    c.create_function(FunctionName=fn, Runtime=os.environ.get("LAMBDA_RUNTIME","python3.12"), Role=os.environ.get("LAMBDA_ROLE","arn:aws:iam::123456789012:role/r"), Handler="h.handler", Code={"ZipFile":b.getvalue()})
    for _ in range(120):
        if c.get_function(FunctionName=fn)["Configuration"].get("State","Active")=="Active": break
        time.sleep(0.5)
    res["create_to_active_s"]=round(time.perf_counter()-t0,2)
    t=time.perf_counter(); r=c.invoke(FunctionName=fn, Payload=b'{"a":1}'); res["first_invoke_ms"]=round((time.perf_counter()-t)*1e3,1)
    res["first_invoke_payload"]=r["Payload"].read().decode()[:200]
    res["Invoke(warm)"]=stats(timed(lambda i: c.invoke(FunctionName=fn, Payload=b'{"a":1}'), min(N,200)))
print(json.dumps({label:{svc:res}}, indent=1))
