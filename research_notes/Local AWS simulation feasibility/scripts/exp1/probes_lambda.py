"""Lambda accuracy probes. Usage: probes_lambda.py <label> <endpoint|aws>   env: LAMBDA_RUNTIME (default python3.12), LAMBDA_ROLE or LAMBDA_CREATE_ROLE=1 (emulators)."""
import os, sys, io, zipfile, json, time, uuid
from botocore.exceptions import ClientError
from common import client
label, ep = sys.argv[1:3]; c = client("lambda", ep); R = {}
RT = os.environ.get("LAMBDA_RUNTIME", "python3.12")
role = os.environ.get("LAMBDA_ROLE")
if os.environ.get("LAMBDA_CREATE_ROLE"):
    iam = client("iam", os.environ.get("IAM_ENDPOINT", ep))
    role = iam.create_role(RoleName="r" + uuid.uuid4().hex[:6], AssumeRolePolicyDocument=json.dumps({"Version": "2012-10-17", "Statement": [{"Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"}, "Action": "sts:AssumeRole"}]}))["Role"]["Arn"]
def rec(pid, expect, obs, match): R[pid] = {"expect": expect, "observed": obs, "match": match}
def mk(src, timeout=3):
    b = io.BytesIO(); z = zipfile.ZipFile(b, "w"); z.writestr("h.py", src); z.close()
    n = "pl-" + uuid.uuid4().hex[:6]
    c.create_function(FunctionName=n, Runtime=RT, Role=role, Handler="h.handler", Code={"ZipFile": b.getvalue()}, Timeout=timeout)
    for _ in range(60):
        if c.get_function(FunctionName=n)["Configuration"].get("State", "Active") == "Active": break
        time.sleep(0.5)
    return n
def inv(n, payload=b"{}", **kw):
    t = time.time()
    try:
        r = c.invoke(FunctionName=n, Payload=payload, **kw); return {"status": r["StatusCode"], "fnerr": r.get("FunctionError"), "body": r["Payload"].read().decode()[:400], "s": round(time.time() - t, 1)}
    except ClientError as e: return {"code": e.response["Error"]["Code"], "msg": e.response["Error"]["Message"][:200], "http": e.response["ResponseMetadata"]["HTTPStatusCode"], "s": round(time.time() - t, 1)}
    except Exception as e: return {"code": type(e).__name__, "msg": str(e)[:200], "s": round(time.time() - t, 1)}
n = mk("def handler(e, c):\n    raise ValueError('boom')\n")
o = inv(n); body = {}
try: body = json.loads(o.get("body", "{}"))
except Exception: pass
rec("L01_unhandled_error_shape", "HTTP 200, X-Amz-Function-Error: Unhandled, payload JSON with errorMessage 'boom', errorType 'ValueError', stackTrace", o, o.get("status") == 200 and o.get("fnerr") == "Unhandled" and body.get("errorType") == "ValueError" and body.get("errorMessage") == "boom")
n = mk("import time\ndef handler(e, c):\n    time.sleep(6)\n    return 'done'\n", timeout=2)
o = inv(n)
rec("L02_timeout_enforced", "Timeout=2s, handler sleeps 6s: 200 + FunctionError Unhandled, errorMessage '... Task timed out after 2.00 seconds', returns in ~2s", o, o.get("fnerr") == "Unhandled" and "timed out" in o.get("body", "") and o.get("s", 99) < 5)
n = mk("def handler(e, c):\n    return len(str(e))\n")
o = inv(n, payload=json.dumps({"d": "x" * (6 * 1024 * 1024 + 10)}).encode())
rec("L03_sync_payload_over_6MB", "413 RequestTooLargeException (sync invoke request payload limit 6 MB)", o, o.get("http") == 413 or o.get("code") == "RequestTooLargeException")
o = inv(n, payload=b"{not json")
rec("L04_invalid_json_payload", "400 InvalidRequestContentException 'Could not parse request body into json'", o, o.get("code") == "InvalidRequestContentException")
o = inv("nonexistent-fn-zzz")
rec("L05_missing_function", "404 ResourceNotFoundException 'Function not found: arn:...'", o, o.get("code") == "ResourceNotFoundException")
o = inv(n, payload=b"{}", InvocationType="Event")
rec("L06_async_event_invoke", "202 status, empty payload", o, o.get("status") == 202)
json.dump({label: R}, open(f"probes_lambda_{label}.json", "w"), indent=1, default=str)
print(label, sum(bool(v["match"]) for v in R.values()), "/", len(R))
for k, v in R.items(): print(" ", k, v["match"], json.dumps(v["observed"])[:260])
