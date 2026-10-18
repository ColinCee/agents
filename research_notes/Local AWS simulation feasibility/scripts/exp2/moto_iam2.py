# Moto IAM enforcement vs. documented AWS policy-evaluation semantics (expected column = AWS docs).
import json,os,boto3,botocore
os.environ.update(AWS_DEFAULT_REGION="us-east-1")
from moto import mock_aws
from moto.core import set_initial_no_auth_action_count
def S(*st): return {"Version":"2012-10-17","Statement":list(st)}
QA="arn:aws:sqs:us-east-1:123456789012:team-a"
cases=[
 ("allow-only-no-matching-resource: Allow SendMessage on team-* ; send to other-q", S({"Effect":"Allow","Action":["sqs:SendMessage","sqs:GetQueueUrl","sqs:CreateQueue"],"Resource":"arn:aws:sqs:*:*:team-*"}),"other-q","send",False),
 ("resource wildcard: Allow SendMessage on team-* ; send to team-a", S({"Effect":"Allow","Action":["sqs:SendMessage"],"Resource":"arn:aws:sqs:*:*:team-*"}),"team-a","send",True),
 ("NotAction allow: Allow NotAction sqs:DeleteQueue ; send", S({"Effect":"Allow","NotAction":"sqs:DeleteQueue","Resource":"*"}),"team-a","send",True),
 ("NotAction allow: same ; delete", S({"Effect":"Allow","NotAction":"sqs:DeleteQueue","Resource":"*"}),"team-a","delete",False),
 ("Deny NotAction sqs:SendMessage + Allow * ; send", S({"Effect":"Allow","Action":"*","Resource":"*"},{"Effect":"Deny","NotAction":"sqs:SendMessage","Resource":"*"}),"team-a","send",True),
 ("Deny NotAction sqs:SendMessage + Allow * ; purge", S({"Effect":"Allow","Action":"*","Resource":"*"},{"Effect":"Deny","NotAction":"sqs:SendMessage","Resource":"*"}),"team-a","purge",False),
 ("Deny w/ false Condition (RequestedRegion eu-west-1) must NOT apply ; send", S({"Effect":"Allow","Action":"*","Resource":"*"},{"Effect":"Deny","Action":"sqs:SendMessage","Resource":"*","Condition":{"StringEquals":{"aws:RequestedRegion":"eu-west-1"}}}),"team-a","send",True),
 ("Deny w/ true Condition (RequestedRegion us-east-1) applies ; send", S({"Effect":"Allow","Action":"*","Resource":"*"},{"Effect":"Deny","Action":"sqs:SendMessage","Resource":"*","Condition":{"StringEquals":{"aws:RequestedRegion":"us-east-1"}}}),"team-a","send",False),
 ("Allow w/ false Condition gives no permission ; send", S({"Effect":"Allow","Action":["sqs:CreateQueue","sqs:GetQueueUrl"],"Resource":"*"},{"Effect":"Allow","Action":"sqs:SendMessage","Resource":"*","Condition":{"StringEquals":{"aws:RequestedRegion":"eu-west-1"}}}),"team-a","send",False),
 ("Deny on specific resource ARN only ; send to team-a", S({"Effect":"Allow","Action":"*","Resource":"*"},{"Effect":"Deny","Action":"sqs:SendMessage","Resource":QA}),"team-a","send",False),
 ("Deny on specific resource ARN only ; send to team-b", S({"Effect":"Allow","Action":"*","Resource":"*"},{"Effect":"Deny","Action":"sqs:SendMessage","Resource":QA}),"team-b","send",True),
 ("Deny NotResource: Deny SendMessage NotResource team-a ; send to team-a", S({"Effect":"Allow","Action":"*","Resource":"*"},{"Effect":"Deny","Action":"sqs:SendMessage","NotResource":QA}),"team-a","send",True),
 ("Deny NotResource ; send to team-b", S({"Effect":"Allow","Action":"*","Resource":"*"},{"Effect":"Deny","Action":"sqs:SendMessage","NotResource":QA}),"team-b","send",False),
 ("Action wildcard case-insensitivity: Allow SQS:SENDMESSAGE", S({"Effect":"Allow","Action":["SQS:SENDMESSAGE","sqs:createqueue","sqs:getqueueurl"],"Resource":"*"}),"team-a","send",True),
]
def run(pol,qname,op):
    root=dict(aws_access_key_id="root",aws_secret_access_key="root")
    iam=boto3.client("iam",**root)
    iam.create_user(UserName="u")
    pa=iam.create_policy(PolicyName="p",PolicyDocument=json.dumps(pol))["Policy"]["Arn"]
    iam.attach_user_policy(UserName="u",PolicyArn=pa)
    k=iam.create_access_key(UserName="u")["AccessKey"]
    adm=boto3.client("sqs",**root)  # root creds: initial count exhausted -> would be checked; so create queue first with admin before counter ends
    return k
out=[]
for desc,pol,qn,op,exp in cases:
    @set_initial_no_auth_action_count(5)  # 4 IAM setup calls + 1 admin create_queue run unauthenticated; later calls are enforced
    def one():
        with mock_aws():
            root=dict(aws_access_key_id="root",aws_secret_access_key="root")
            iam=boto3.client("iam",**root); iam.create_user(UserName="u")
            pa=iam.create_policy(PolicyName="p",PolicyDocument=json.dumps(pol))["Policy"]["Arn"]
            iam.attach_user_policy(UserName="u",PolicyArn=pa)
            k=iam.create_access_key(UserName="u")["AccessKey"]
            adm=boto3.client("sqs",**root)
            qu=adm.create_queue(QueueName=qn)["QueueUrl"]
            u=boto3.client("sqs",aws_access_key_id=k["AccessKeyId"],aws_secret_access_key=k["SecretAccessKey"])
            try:
                if op=="send": u.send_message(QueueUrl=qu,MessageBody="x")
                elif op=="delete": u.delete_queue(QueueUrl=qu)
                elif op=="purge": u.purge_queue(QueueUrl=qu)
                return True
            except botocore.exceptions.ClientError as e: return False
            except Exception as e: return "ERR "+repr(e)[:60]
    got=one(); out.append((desc,exp,got))
ok=sum(1 for d,e,g in out if e==g)
for d,e,g in out: print(("OK  " if e==g else "MISMATCH ")+f"expected_allowed={e} moto_allowed={g} :: {d}")
print(f"{ok}/{len(out)} match documented AWS semantics")
