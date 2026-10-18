"""Moto in-process (mock_aws decorator mode, no HTTP server): same ops as bench.py, boto3 calls intercepted by botocore hooks."""
import json, time, uuid
from moto import mock_aws
import boto3
from common import stats, timed
out = {}
with mock_aws():
    d = boto3.client("dynamodb", region_name="us-east-1"); t = "t"
    d.create_table(TableName=t, KeySchema=[{"AttributeName": "pk", "KeyType": "HASH"}], AttributeDefinitions=[{"AttributeName": "pk", "AttributeType": "S"}], BillingMode="PAY_PER_REQUEST")
    for i in range(50): d.put_item(TableName=t, Item={"pk": {"S": f"w{i}"}})
    out["ddb PutItem"] = stats(timed(lambda i: d.put_item(TableName=t, Item={"pk": {"S": f"k{i}"}, "v": {"S": "x" * 100}}), 1000))
    out["ddb GetItem"] = stats(timed(lambda i: d.get_item(TableName=t, Key={"pk": {"S": f"k{i}"}}), 1000))
    s = boto3.client("sqs", region_name="us-east-1"); q = s.create_queue(QueueName="q")["QueueUrl"]
    out["sqs SendMessage"] = stats(timed(lambda i: s.send_message(QueueUrl=q, MessageBody="x" * 100), 1000))
    def rd(i):
        m = s.receive_message(QueueUrl=q, MaxNumberOfMessages=1).get("Messages")
        if m: s.delete_message(QueueUrl=q, ReceiptHandle=m[0]["ReceiptHandle"])
    out["sqs Receive+Delete"] = stats(timed(rd, 1000))
print(json.dumps({"moto_inprocess": out}, indent=1))
