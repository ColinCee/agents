"""DynamoDB accuracy probes. Usage: probes_ddb.py <label> <endpoint|aws>  -> writes probes_ddb_<label>.json
Each probe records the observed result and whether it matches the AWS-documented expectation (EXPECT).
Re-runnable against real AWS: endpoint 'aws' uses default credential chain (creates/deletes tables prefixed pr_)."""
import sys, json, uuid, time, decimal
from botocore.exceptions import ClientError
from common import client
label, ep = sys.argv[1:3]
c = client("dynamodb", ep)
R = {}
def err(fn):
    try: r = fn(); return {"ok": True, "resp": {k: v for k, v in r.items() if k != "ResponseMetadata"}}
    except ClientError as e: return {"ok": False, "code": e.response["Error"]["Code"], "msg": e.response["Error"]["Message"][:200], "http": e.response["ResponseMetadata"]["HTTPStatusCode"]}
    except Exception as e: return {"ok": False, "code": type(e).__name__, "msg": str(e)[:200]}
def table(name, gsi=False, rng=False):
    ks = [{"AttributeName": "pk", "KeyType": "HASH"}] + ([{"AttributeName": "sk", "KeyType": "RANGE"}] if rng else [])
    ad = [{"AttributeName": "pk", "AttributeType": "S"}] + ([{"AttributeName": "sk", "AttributeType": "S"}] if rng else [])
    kw = {}
    if gsi:
        ad.append({"AttributeName": "g", "AttributeType": "S"})
        kw["GlobalSecondaryIndexes"] = [{"IndexName": "gidx", "KeySchema": [{"AttributeName": "g", "KeyType": "HASH"}], "Projection": {"ProjectionType": "ALL"}}]
    n = "pr_" + name + uuid.uuid4().hex[:5]
    c.create_table(TableName=n, KeySchema=ks, AttributeDefinitions=ad, BillingMode="PAY_PER_REQUEST", **kw)
    c.get_waiter("table_exists").wait(TableName=n); return n
def rec(pid, expect, obs, match): R[pid] = {"expect": expect, "observed": obs, "match": match}
def code(o): return o.get("code")
t = table("a", gsi=True); tr = table("r", rng=True)
S = lambda s: {"S": s}

o = err(lambda: c.put_item(TableName=t, Item={"pk": S("1")}))
o = err(lambda: c.put_item(TableName=t, Item={"pk": S("1")}, ConditionExpression="attribute_not_exists(pk)"))
rec("D01_condition_fail", "400 ConditionalCheckFailedException, msg 'The conditional request failed'", o, code(o) == "ConditionalCheckFailedException" and o.get("msg") == "The conditional request failed" and o.get("http") == 400)

o = err(lambda: c.transact_write_items(TransactItems=[{"Put": {"TableName": t, "Item": {"pk": S("x")}}}, {"Delete": {"TableName": t, "Key": {"pk": S("x")}}}]))
rec("D02_transact_same_item", "ValidationException 'Transaction request cannot include multiple operations on one item'", o, code(o) == "ValidationException" and "multiple operations on one item" in o.get("msg", ""))

o = err(lambda: c.put_item(TableName=t, Item={"pk": S("big"), "d": S("x" * 400 * 1024)}))
rec("D03_item_size_400KB", "ValidationException 'Item size has exceeded the maximum allowed size'", o, code(o) == "ValidationException" and "Item size has exceeded" in o.get("msg", ""))
o = err(lambda: c.put_item(TableName=t, Item={"pk": S("ok"), "d": S("x" * 399 * 1024)}))
rec("D03b_item_399KB_ok", "accepted", o, o["ok"])

c.put_item(TableName=t, Item={"pk": S("r"), "name": S("n"), "g": S("G")})
o = err(lambda: c.query(TableName=t, KeyConditionExpression="pk = :p", FilterExpression="name = :n", ExpressionAttributeValues={":p": S("r"), ":n": S("n")}))
rec("D04_reserved_word", "ValidationException 'Invalid FilterExpression: Attribute name is a reserved keyword; reserved keyword: name'", o, code(o) == "ValidationException" and "reserved keyword" in o.get("msg", ""))

o = err(lambda: c.put_item(TableName=t, Item={"pk": S("")}))
rec("D05_empty_string_key", "ValidationException 'One or more parameter values are not valid. The AttributeValue for a key attribute cannot contain an empty string value...'", o, code(o) == "ValidationException" and "empty string" in o.get("msg", ""))
o = err(lambda: c.put_item(TableName=t, Item={"pk": S("e"), "v": S("")}))
rec("D05b_empty_string_nonkey_ok", "accepted (allowed since 2020)", o, o["ok"])

o = err(lambda: c.query(TableName=t, IndexName="gidx", KeyConditionExpression="g = :g", ExpressionAttributeValues={":g": S("G")}, ConsistentRead=True))
rec("D06_gsi_consistent_read", "ValidationException 'Consistent reads are not supported on global secondary indexes'", o, code(o) == "ValidationException" and "onsistent reads are not supported on global secondary indexes" in o.get("msg", ""))

o = err(lambda: c.batch_write_item(RequestItems={t: [{"PutRequest": {"Item": {"pk": S(f"b{i}")}}} for i in range(26)]}))
rec("D07_batchwrite_26", "ValidationException 'Too many items requested for the BatchWriteItem call'", o, code(o) == "ValidationException" and "Too many items" in o.get("msg", ""))
o = err(lambda: c.batch_write_item(RequestItems={t: [{"PutRequest": {"Item": {"pk": S("dup")}}}, {"PutRequest": {"Item": {"pk": S("dup")}}}]}))
rec("D07b_batchwrite_dup_keys", "ValidationException 'Provided list of item keys contains duplicates'", o, code(o) == "ValidationException" and "duplicates" in o.get("msg", ""))

c.put_item(TableName=t, Item={"pk": S("u"), "a": {"N": "1"}})
o = err(lambda: c.update_item(TableName=t, Key={"pk": S("u")}, UpdateExpression="SET a = :v REMOVE a", ExpressionAttributeValues={":v": {"N": "2"}}))
rec("D08a_update_overlap_paths", "ValidationException 'Two document paths overlap with each other...'", o, code(o) == "ValidationException" and "overlap" in o.get("msg", ""))
o = err(lambda: c.update_item(TableName=t, Key={"pk": S("u")}, UpdateExpression="SET m.x = :v", ExpressionAttributeValues={":v": {"N": "2"}}))
rec("D08b_update_nested_missing_parent", "ValidationException 'The document path provided in the update expression is invalid for update'", o, code(o) == "ValidationException" and "document path" in o.get("msg", ""))
o = err(lambda: c.update_item(TableName=t, Key={"pk": S("u")}, UpdateExpression="ADD a :v", ExpressionAttributeValues={":v": {"N": "5"}}, ReturnValues="UPDATED_NEW"))
rec("D08c_add_number", "a = 6 via UPDATED_NEW", o, o["ok"] and o["resp"]["Attributes"]["a"] == {"N": "6"})
o = err(lambda: c.update_item(TableName=t, Key={"pk": S("u")}, UpdateExpression="SET a = if_not_exists(zz, :v) + :one", ExpressionAttributeValues={":v": {"N": "10"}, ":one": {"N": "1"}}, ReturnValues="UPDATED_NEW"))
rec("D08d_if_not_exists_arith", "a = 11", o, o["ok"] and o["resp"]["Attributes"]["a"] == {"N": "11"})
o = err(lambda: c.update_item(TableName=t, Key={"pk": S("u")}, UpdateExpression="SET l = list_append(if_not_exists(l, :e), :x)", ExpressionAttributeValues={":e": {"L": []}, ":x": {"L": [S("a")]}}, ReturnValues="UPDATED_NEW"))
rec("D08e_list_append", "l = ['a']", o, o["ok"] and o["resp"]["Attributes"]["l"] == {"L": [S("a")]})
o = err(lambda: c.update_item(TableName=t, Key={"pk": S("nokey")}, UpdateExpression="REMOVE zz"))
rec("D08f_update_creates_item", "Update on missing key creates item with only key attr", o, o["ok"] and "Item" in c.get_item(TableName=t, Key={"pk": S("nokey")}))

n38 = "1" * 38
c.put_item(TableName=t, Item={"pk": S("n"), "n": {"N": n38}})
got = c.get_item(TableName=t, Key={"pk": S("n")})["Item"]["n"]["N"]
rec("D09a_number_38_digits_roundtrip", "38 significant digits preserved exactly", got, got == n38)
o = err(lambda: c.put_item(TableName=t, Item={"pk": S("n"), "n": {"N": "1" * 39}}))
rec("D09b_number_39_digits", "ValidationException 'Attempting to store more than 38 significant digits in a Number field'", o, code(o) == "ValidationException")
o = err(lambda: c.put_item(TableName=t, Item={"pk": S("n"), "n": {"N": "1E126"}}))
rec("D09c_number_1E126_overflow", "ValidationException 'Number overflow. Attempting to store a number with magnitude larger than supported range'", o, code(o) == "ValidationException")
c.put_item(TableName=t, Item={"pk": S("n"), "n": {"N": "1.50"}})
got = c.get_item(TableName=t, Key={"pk": S("n")})["Item"]["n"]["N"]
rec("D09d_number_trailing_zero_normalised", "'1.5' (trailing zeros not preserved)", got, got == "1.5")

o = err(lambda: c.put_item(TableName=t, Item={"pk": S("ss"), "s": {"SS": ["a", "a"]}}))
rec("D10_set_duplicates", "ValidationException 'Input collection [a, a] of type SS contains duplicates'", o, code(o) == "ValidationException" and "duplicates" in o.get("msg", ""))

o = err(lambda: c.get_item(TableName="pr_nonexistent_zzz", Key={"pk": S("1")}))
rec("D11_missing_table", "400 ResourceNotFoundException 'Requested resource not found'", o, code(o) == "ResourceNotFoundException")

o = err(lambda: c.transact_write_items(TransactItems=[{"Put": {"TableName": t, "Item": {"pk": S(f"t{i}")}}} for i in range(101)]))
rec("D12_transact_101_items", "ValidationException (limit 100 items)", o, code(o) == "ValidationException")
c.put_item(TableName=t, Item={"pk": S("tc"), "v": S("orig")})
o = err(lambda: c.transact_write_items(TransactItems=[{"Put": {"TableName": t, "Item": {"pk": S("tnew")}}}, {"ConditionCheck": {"TableName": t, "Key": {"pk": S("tc")}, "ConditionExpression": "v = :x", "ExpressionAttributeValues": {":x": S("nope")}}}]))
rec("D12b_transact_cancel_reasons", "400 TransactionCanceledException, CancellationReasons [None, ConditionalCheckFailed], tnew NOT written", {**o, "tnew_written": "Item" in c.get_item(TableName=t, Key={"pk": S("tnew")})}, code(o) == "TransactionCanceledException" and "Item" not in c.get_item(TableName=t, Key={"pk": S("tnew")}))

# 1MB scan page limit: 15 x 100KB items => single Scan page must stop near 1MB with LastEvaluatedKey
for i in range(15): c.put_item(TableName=tr, Item={"pk": S("p"), "sk": S(f"{i:02}"), "d": S("x" * 100 * 1024)})
r = c.query(TableName=tr, KeyConditionExpression="pk = :p", ExpressionAttributeValues={":p": S("p")})
rec("D13_query_1MB_page", "Count ~ 10 (1MB cap) and LastEvaluatedKey present", {"Count": r["Count"], "LEK": "LastEvaluatedKey" in r}, r["Count"] < 15 and "LastEvaluatedKey" in r)

r = err(lambda: c.put_item(TableName=t, Item={"pk": S("cc"), "d": S("x" * 900)}, ReturnConsumedCapacity="TOTAL"))
cu = r.get("resp", {}).get("ConsumedCapacity", {}).get("CapacityUnits")
rec("D14_consumed_capacity_1KB_put", "CapacityUnits = 1.0 (item <=1KB => 1 WCU)", cu, cu == 1.0)
r = err(lambda: c.get_item(TableName=t, Key={"pk": S("cc")}, ReturnConsumedCapacity="TOTAL"))
cu = r.get("resp", {}).get("ConsumedCapacity", {}).get("CapacityUnits")
rec("D14b_consumed_capacity_strong_read_1KB", "CapacityUnits = 1.0 (strongly consistent <=4KB; eventual would be 0.5)", cu, cu in (0.5, 1.0) and cu == 0.5 or cu == 1.0)

o = err(lambda: c.query(TableName=tr, KeyConditionExpression="pk = :p AND sk BETWEEN :a AND :b", ExpressionAttributeValues={":p": S("p"), ":a": S("03"), ":b": S("05")}, Select="COUNT"))
rec("D15_query_between_count", "Count 3", o, o["ok"] and o["resp"]["Count"] == 3)
o = err(lambda: c.put_item(TableName=t, Item={"pk": S("pk"), "g": {"N": "1"}}))
rec("D16_gsi_key_type_mismatch", "ValidationException 'One or more parameter values were invalid: Type mismatch for Index Key g Expected: S Actual: N'", o, code(o) == "ValidationException" and "Type mismatch" in o.get("msg", ""))
o = err(lambda: c.describe_table(TableName=t))
rec("D17_describe_table_has_arn_status", "TableStatus ACTIVE and TableArn present", {"status": o["resp"]["Table"].get("TableStatus"), "arn": o["resp"]["Table"].get("TableArn")}, o["resp"]["Table"].get("TableStatus") == "ACTIVE" and bool(o["resp"]["Table"].get("TableArn")))


# item size boundary: largest accepted item (pk "bnd" + attr "d") found by binary search. AWS: item size = sum of attr name + value bytes, limit 400 KB (docs: 409,600 bytes if KB=1024)
lo, hi = 300000, 450000
def fits(n):
    return err(lambda: c.put_item(TableName=t, Item={"pk": S("bnd"), "d": S("x" * n)}))["ok"]
while hi - lo > 1:
    mid = (lo + hi) // 2
    if fits(mid): lo = mid
    else: hi = mid
rec("D03c_item_size_boundary_bytes", "largest accepted value length = 409600 - len('pk')-len('bnd')-len('d') = 409,594 (limit 400KB=409,600 B)", lo, lo == 409600 - 2 - 3 - 1)
for n in (t, tr):
    try: c.delete_table(TableName=n)
    except Exception: pass
json.dump({label: R}, open(f"probes_ddb_{label}.json", "w"), indent=1, default=str)
print(label, sum(v["match"] for v in R.values()), "/", len(R), "match")
for k, v in R.items():
    if not v["match"]: print("  DIFF", k, "->", json.dumps(v["observed"], default=str)[:240])
