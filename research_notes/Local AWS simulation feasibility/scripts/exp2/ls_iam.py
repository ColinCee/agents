# LocalStack community: is IAM enforced? (Also with ENFORCE_IAM=1 set in server env if that was tried.)
import json,boto3,botocore
kw=dict(endpoint_url="http://localhost:4566",region_name="us-east-1")
iam=boto3.client("iam",aws_access_key_id="test",aws_secret_access_key="test",**kw)
try: iam.delete_user(UserName="u")
except Exception: pass
iam.create_user(UserName="u")
pol={"Version":"2012-10-17","Statement":[{"Effect":"Deny","Action":"sqs:*","Resource":"*"}]}
pa=iam.create_policy(PolicyName="deny-sqs",PolicyDocument=json.dumps(pol))["Policy"]["Arn"]
iam.attach_user_policy(UserName="u",PolicyArn=pa)
k=iam.create_access_key(UserName="u")["AccessKey"]
sq=boto3.client("sqs",aws_access_key_id=k["AccessKeyId"],aws_secret_access_key=k["SecretAccessKey"],**kw)
try: print("create_queue as user with Deny sqs:* ->",sq.create_queue(QueueName="deny-test")["QueueUrl"],"(ALLOWED)")
except botocore.exceptions.ClientError as e: print("DENIED",e.response["Error"]["Code"])
