import json,os,boto3,botocore
os.environ.update(AWS_DEFAULT_REGION="us-east-1")
from moto import mock_aws, settings
from moto.core import set_initial_no_auth_action_count
DENY={"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"sqs:*","Resource":"*"},{"Effect":"Deny","Action":"sqs:DeleteQueue","Resource":"*"}]}
def run(label):
    iam=boto3.client("iam",aws_access_key_id="root",aws_secret_access_key="root")
    iam.create_user(UserName="u")
    pa=iam.create_policy(PolicyName="p",PolicyDocument=json.dumps(DENY))["Policy"]["Arn"]
    iam.attach_user_policy(UserName="u",PolicyArn=pa)
    k=iam.create_access_key(UserName="u")["AccessKey"]
    sq=boto3.client("sqs",aws_access_key_id=k["AccessKeyId"],aws_secret_access_key=k["SecretAccessKey"])
    q=sq.create_queue(QueueName="q")["QueueUrl"]
    res={}
    for name,fn in [("sqs:DeleteQueue (explicit deny)",lambda:sq.delete_queue(QueueUrl=q)),("ec2:DescribeInstances (no allow -> implicit deny)",lambda:boto3.client("ec2",aws_access_key_id=k["AccessKeyId"],aws_secret_access_key=k["SecretAccessKey"]).describe_instances())]:
        try: fn(); res[name]="ALLOWED"
        except botocore.exceptions.ClientError as e: res[name]="DENIED "+e.response["Error"]["Code"]
    print(label,json.dumps(res,indent=1))
with mock_aws(): run("moto default")
@set_initial_no_auth_action_count(4)
def enforced():
    with mock_aws(): run("moto with INITIAL_NO_AUTH_ACTION_COUNT=4")
# setup calls: create_user, create_policy, attach_user_policy, create_access_key = 4 free calls
enforced()
