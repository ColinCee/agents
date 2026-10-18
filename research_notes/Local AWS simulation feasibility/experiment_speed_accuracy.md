# Measured speed and accuracy of local AWS emulators (DynamoDB, SQS, Lambda)

Method note. All numbers below were measured by me in this sandbox; none are from vendor claims. "Expected" behaviour is taken from AWS API documentation, read from the AWS-authored doc strings shipped inside botocore's service models (`botocore/data/<svc>/.../service-2.json.gz`, mirrored at https://github.com/boto/botocore/tree/develop/botocore/data), because docs.aws.amazon.com, aws.amazon.com and repost.aws were unreachable from this sandbox (proxy deny / DNS failure). Where I relied on memory of real-AWS behaviour instead of a quotable doc, it is flagged "unverified expectation".

Machine: Linux 6.18 (Firecracker-style VM), 4 vCPU Intel Xeon @ 2.80 GHz, 16 GB RAM, Python 3.13.16, Node 22.22, OpenJDK 21.0.12. Load average during runs about 0.5 to 0.8 (a sibling research agent also ran a LocalStack on the same VM at times; numbers are indicative, not isolated benchmarks). Client: boto3/botocore 1.42.72 over plain HTTP on 127.0.0.1, one synchronous client, sequential calls (no concurrency), 1000 ops per cell after 50 warmups, `keep-alive` on, retries off.

Versions: Moto 5.2.4 (`moto.server` and `mock_aws`), DynamoDB Local = `dynamodb_local_latest` fetched from AWS's S3 bucket on 2026-10-18 (Java, `-inMemory`), ElasticMQ 1.6.11 jar, LocalStack core 2026.3.0 Community from PyPI (`localstack-core[runtime]`, run on host, no container).

All scripts are in `/tmp/claude-0/-home-user-agents/4aafdca6-ae8f-5b36-81e1-5c664f9ede2c/scratchpad/exp1/` (listed at the end). Raw results are the `*.json` files there.

## 1. What could be installed and started, and cold-start time

### Takeaway
Moto, DynamoDB Local, ElasticMQ and LocalStack all ran here. Moto starts fastest (about 0.6 s server, 0.66 s in-process including import), the JVM tools take 2 to 3.5 s, LocalStack about 3.8 s to its first DynamoDB answer. The Docker CLI was present but the daemon was not running; I started `dockerd` (vfs storage) by hand, and it worked, but AWS's Lambda base images could not be pulled, so LocalStack Lambda was blocked.

### Cited Findings
Measured cold start = process spawn to first successful `ListTables`/`ListQueues` via boto3, 3 runs each (`startup_time.py`):
- Moto server (`python -m moto.server -p 5001`): 0.61, 0.55, 0.60 s. Moto in-process (`import moto` + `mock_aws` + first call, one run): 0.66 s.
- DynamoDB Local (`java -jar DynamoDBLocal.jar -inMemory`): 3.18, 3.44, 3.44 s.
- ElasticMQ 1.6.11 (`java -jar elasticmq.jar`): 2.17, 2.55, 2.65 s.
- LocalStack core on host, `SERVICES=dynamodb,sqs,lambda`: first DynamoDB call answered after 3.80, 3.78, 3.78 s (includes launching its bundled DynamoDB Local JVM); first SQS call 1.45, 2.25, 2.14 s (SQS is in-process Python). Gateway "ready" log at about 1.35 s.
- Docker: `docker info` initially returned "failed to connect to the docker API at unix:///var/run/docker.sock" (daemon not running). `dockerd --storage-driver=vfs` started as root and came up in under 12 s; `docker pull alpine` and Docker Hub images worked. Pulling `public.ecr.aws/lambda/python:3.12` failed with "Forbidden" because the layer host `d2glxqk2uabbnd.cloudfront.net` is denied by the egress proxy (proxy status listed it under rejected CONNECTs).
- Download blockers hit: the official DynamoDB Local URL on CloudFront (`d1ni2b6xgvw0s0.cloudfront.net`) returned 403 from the proxy; the same file from AWS's S3 bucket (`https://s3.us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.tar.gz`) worked. `pip install localstack` installs only the CLI; the CLI prints "The 'localstack' CLI is deprecated. Use the 'lstk' CLI" and needs Docker. To run the LocalStack runtime without Docker I installed `localstack-core[runtime]` and had to pin `cryptography==43.0.3`, `pyopenssl==24.2.1`, `service_identity==24.2.0`, `cbor2<6` to get past import errors. LocalStack also tried to download DynamoDB Local from the blocked CloudFront URL, so I installed its DynamoDB package manually from the S3 URL plus `ddb-local-loader` from raw.githubusercontent.com (`ls_install.py`, `ls_launch.py`). So "LocalStack without Docker" works for DynamoDB and SQS but needed manual workarounds in this sandbox; on a normal machine `docker run localstack/localstack` is the supported path. LocalStack's own docs say Lambda needs the Docker socket mounted: [LocalStack Lambda docs](https://docs.localstack.cloud/aws/services/lambda/), [mounting the docker socket](https://hashnode.localstack.cloud/mounting-the-docker-socket); the old non-Docker "local" executor was removed in LocalStack 2.0 ([discuss.localstack.cloud](https://discuss.localstack.cloud/t/new-lambda-implementation-in-localstack-2-0/258)); I confirmed only a `docker` runtime-executor plugin exists in the installed package's entry points.
- LocalStack run without Docker prints "ERROR: '['docker', 'ps']' ... Ready." and keeps serving non-Lambda services.

### Inferences
- For unit tests that live inside a Python process Moto `mock_aws` has effectively no process cost; JVM-based tools pay 2 to 3.5 s once per suite.
- A CI environment without a Docker daemon or with a blocked ECR (like this one) cannot test Lambda with LocalStack at all.

### Gaps
- No Node-based emulator (e.g. dynalite, `@shelf/jest-dynamodb`) was tested. No Windows/macOS numbers. Startup was measured with the machine otherwise idle but only 3 runs.

## 2. Latency and throughput

### Takeaway
On this VM, DynamoDB Local was fastest for DynamoDB (p50 3.1 ms Put, 1.9 ms Get); Moto server was close (3.9/3.3 ms); LocalStack roughly 3x slower (10.6/7.1 ms) because it proxies to a DynamoDB Local JVM. Moto in-process is about 1 ms. For SQS, ElasticMQ and LocalStack are about 2 to 3 ms per call on a shallow queue; Moto server is 4.5 ms and gets much worse as queue depth grows. Lambda: the only runnable path (Moto + Docker + a Docker Hub image) took about 21 s per invoke here, so no meaningful throughput exists.

### Cited Findings
DynamoDB, 1000 sequential ops, item `{pk, v: 100-byte string}`, on-demand table, via `bench.py`:

| Tool | PutItem p50 / p99 ms | PutItem ops/s | GetItem p50 / p99 ms | GetItem ops/s |
|---|---|---|---|---|
| Moto server | 3.91 / 5.87 | 251 | 3.27 / 5.33 | 292 |
| Moto in-process (`mock_aws`) | 0.97 / 2.52 | 953 | 0.94 / 1.27 | 1039 |
| DynamoDB Local (-inMemory) | 3.10 / 8.53 | 285 | 1.94 / 5.37 | 461 |
| LocalStack (host, no Docker) | 10.56 / 17.09 | 92 | 7.13 / 11.28 | 136 |

SQS, 100-byte standard queue, 1000 ops (`bench.py`; queue depth grows to 1000 during send, then drained by receive+delete):

| Tool | Send p50 / p99 ms | Send ops/s | Receive(1)+Delete p50 / p99 ms | pairs/s |
|---|---|---|---|---|
| Moto server | 11.09 / 20.62 | 89 | 29.20 / 62.18 | 34 |
| Moto in-process | 5.94 / 16.02 | 162 | 18.06 / 42.08 | 54 |
| ElasticMQ | 3.88 / 8.37 | 246 | 5.67 / 12.04 | 163 |
| LocalStack | 3.17 / 5.84 | 299 | 6.39 / 11.09 | 150 |

SQS with queue depth about 0 (send 1, receive 1, delete 1, 500 iterations, `bench_sqs_shallow.py`), p50 / p99 ms:
- Moto server: send 4.53 / 8.86, receive 4.93 / 7.83, delete 4.25 / 8.63.
- ElasticMQ: send 2.28 / 4.13, receive 2.29 / 4.74, delete 2.06 / 3.57.
- LocalStack: send 2.86 / 5.57, receive 2.87 / 5.73, delete 2.83 / 5.04.
- Moto's deep-queue slowness (29 ms receive at depth up to 1000, versus 4.9 ms at depth 1) indicates cost that grows with queue depth.

Lambda (`bench.py lambda`, `probes_lambda.py`):
- Moto server without a Docker daemon: `Invoke` returns HTTP 200 with payload `error running docker: Error while fetching server API version...` (looks like a success to a caller that only checks the status code; p50 7.7 ms, which is meaningless).
- Moto server with Docker daemon plus `mlupin/docker-lambda:python3.8` pulled from Docker Hub: first invoke 22.8 s, next 8 invokes p50 20.8 s, p99 23.1 s (about 0.05 invokes/s). Moto starts a fresh container per invoke; `dockerd` here used the slow `vfs` storage driver, so this is an upper bound for a normal host. Runtime had to be `python3.8` because only that image was pullable; newer runtimes were not tested.
- LocalStack Lambda: `CreateFunction` succeeded but the function went to state `Failed` ("Docker not available" / "Failed to pull Docker image"), `Invoke` raised ResourceConflictException (state Failed). Not benchmarkable.
- DynamoDB Local and ElasticMQ do not provide Lambda.

Published real-AWS figures for comparison:
- AWS's developer guide says DynamoDB is built to deliver "single-digit millisecond performance at any scale" ([What is Amazon DynamoDB?](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html), quoted via search snippet; page itself not fetchable here). The AWS Database Blog says the same for single-item reads and writes ([Understanding DynamoDB latency](https://aws.amazon.com/blogs/database/understanding-amazon-dynamodb-latency/), snippet only). The CloudWatch latency metric is server-side and excludes network/client time ([Blue Matador](https://www.bluematador.com/docs/troubleshooting/aws-dynamodb-latency)); a third party cites 10 to 20 ms typical end-to-end ([Dynobase](https://dynobase.dev/dynamodb-performance-latency/), secondary, older).
- I found no authoritative published SQS or Lambda per-call latency figure (search returned none), so there is no cited AWS baseline for them; do not quote one without measuring against real AWS with these scripts.

### Inferences
- Sequential single-client numbers here are dominated by boto3 client overhead and loopback HTTP (about 1 ms floor, shown by Moto in-process at about 0.95 ms). Against real AWS from within a region the same scripts would be bounded by network RTT plus server time, i.e. the emulators are "same order of magnitude or faster" for DynamoDB, but this has to be confirmed with the scripts rather than assumed.
- LocalStack's extra 5 to 7 ms on DynamoDB is the cost of its gateway plus proxying to the DynamoDB Local subprocess.
- Emulator latency is not a good proxy for AWS's latency distribution (no tail from cross-AZ or throttling); use them for functional, not performance, tests.

### Gaps
- No concurrency/throughput scaling test (single client only). No real-AWS baseline run (no credentials). No LocalStack-in-Docker numbers (container overhead untested). No Lambda throughput on a normal host.

## 3. Accuracy probes versus AWS documentation

### Takeaway
DynamoDB Local and LocalStack (which wraps DynamoDB Local) matched AWS on 30 of 31 DynamoDB probes; the single miss is only an error-message text on GSI ConsistentRead (same error code). Moto matched 23 of 31 and silently accepts invalid input in several cases (39-digit numbers, number overflow, duplicate set members, GSI key type mismatch, BatchWriteItem of 26 items). For SQS, Moto and LocalStack matched everything except LocalStack redelivering late (up to about 1 s), while ElasticMQ 1.6.11 still enforces the old 256 KiB limit and differs in 3 more probes. Lambda emulation is thin everywhere (see below).

### Cited Findings: scored table
Legend: OK = matches expectation; DIFF = differs; blank = not applicable. "Expectation" is the cited doc statement or flagged as unverified. Scripts: `probes_ddb.py`, `probes_sqs.py`, `probes_lambda.py` (results in `probes_*_<tool>.json`).

DynamoDB (Moto = server mode, 5.2.4):

| Probe | Expected (source) | Moto | DDB Local | LocalStack |
|---|---|---|---|---|
| D01 ConditionExpression fails | 400 `ConditionalCheckFailedException`, "The conditional request failed" (unverified exact message; code per API docs) | OK | OK | OK |
| D02 TransactWriteItems, Put+Delete same item | rejected `ValidationException` "Transaction request cannot include multiple operations on one item"; docs: [TransactWriteItems](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html) says two actions on one item are not allowed. A re:Post article quotes the message but its summary mentions TransactionConflictException for concurrent conflicts, a separate case ([re:Post](https://repost.aws/knowledge-center/dynamodb-transactwriteitems), via search snippet) | OK | OK | OK |
| D03 item of 400 KB + 1 value | `ValidationException` "Item size has exceeded the maximum allowed size"; limit 400 KB per botocore doc ("individual items can be up to 400 KB once stored") | OK | OK | OK |
| D03b 399 KiB item accepted | accepted (400 KB = 409,600 B if KB=1024; unverified whether AWS counts KiB) | DIFF (rejected) | OK | OK |
| D03c largest accepted value length | 409,594 B if limit is 409,600 incl. attribute names | DIFF (404,994) | OK (409,594) | OK (409,594) |
| D04 reserved word `name` in FilterExpression, no ExpressionAttributeNames | `ValidationException` "reserved keyword" (doc: "conflicts with a DynamoDB reserved word, so it cannot be used directly") | OK | OK | OK |
| D05 empty string as key | `ValidationException` (doc: String values "must have a length greater than zero if the attribute is used as a key attribute") | OK | OK | OK |
| D05b empty string, non-key | allowed (doc: "Empty String and Binary attribute values are allowed") | OK | OK | OK |
| D06 Query GSI with ConsistentRead=true | rejected; doc: "Global secondary indexes support eventually consistent reads only, so do not specify ConsistentRead when querying a GSI". Message expected "Consistent reads are not supported on global secondary indexes" (unverified text) | OK | DIFF: code ok, message "Consistent read cannot be true when querying a GSI" | DIFF (same message) |
| D07 BatchWriteItem with 26 puts | `ValidationException` "Too many items requested for the BatchWriteItem call" (doc: "more than 25 requests in the batch" is an error) | DIFF (accepted all 26) | OK | OK |
| D07b duplicate keys in batch | rejected (doc: "at least two items with identical hash and range keys") | OK | OK | OK |
| D08a `SET a=:v REMOVE a` | `ValidationException` "Two document paths overlap" (unverified text) | OK | OK | OK |
| D08b SET `m.x` when `m` missing | `ValidationException` "document path provided in the update expression is invalid for update" (unverified text) | OK | OK | OK |
| D08c ADD on number, D08d `if_not_exists` + arithmetic, D08e `list_append`, D08f update on missing key creates item | per UpdateItem docs (functional) | OK | OK | OK |
| D09a 38-digit number round trip | preserved exactly (docs: up to 38 digits of precision) | OK | OK | OK |
| D09b 39-digit number | rejected (unverified exact text) | DIFF (accepted) | OK | OK |
| D09c `1E126` | rejected as overflow (unverified exact text) | DIFF (accepted) | OK | OK |
| D09d `1.50` read back | `1.5` (AWS normalises numbers; unverified) | DIFF (`1.50`) | OK | OK |
| D10 SS with duplicate members | rejected `ValidationException` ... "contains duplicates" (unverified text) | DIFF (accepted) | OK | OK |
| D11 missing table | `ResourceNotFoundException` | OK | OK | OK |
| D12 TransactWriteItems with 101 items | rejected (100-item limit per the API docs summary above) | OK | OK | OK |
| D12b transaction cancelled by ConditionCheck | `TransactionCanceledException`, other write not applied | OK | OK (reasons `[None, ConditionalCheckFailed]`) | OK |
| D13 Query on 15 x 100 KB items | page stops at 1 MB with `LastEvaluatedKey` (botocore doc mentions the 1 MB limit) | OK | OK | OK |
| D14 ConsumedCapacity for ~1 KB put / get | 1.0 WCU; read 0.5 or 1.0 RCU depending on consistency | OK | OK | OK |
| D15 BETWEEN on sort key, Select=COUNT | count 3 | OK | OK | OK |
| D16 put with GSI key attr of wrong type | `ValidationException` "Type mismatch for Index Key" (unverified text) | DIFF (accepted) | OK | OK |
| D17 DescribeTable status/ARN | ACTIVE + ARN | OK | OK | OK |
| **Total** | | **23/31** | **30/31** | **30/31** |

Footnote on D06: the three emulators all return a `ValidationException`, so a client that branches on the error code behaves the same; only message text differs.

SQS (all via `probes_sqs.py`; Moto server, ElasticMQ 1.6.11, LocalStack):

| Probe | Expected (source) | Moto | ElasticMQ | LocalStack |
|---|---|---|---|---|
| S01 visibility timeout 2 s: hidden, redelivered, `ApproximateReceiveCount`=2 | standard SQS behaviour | OK | OK | OK |
| S02 FIFO duplicate `MessageDeduplicationId`: one delivered | botocore SQS doc: with content-based dedup, identical content "sent within the deduplication interval are treated as duplicates and only one copy of the message is delivered" (interval is 5 minutes; only the delivered count is scored) | OK (returns a different MessageId for the duplicate) | OK (same MessageId) | OK (same MessageId) |
| S02b content-based dedup | one delivered | OK | OK | OK |
| S02c FIFO send without MessageGroupId | rejected | OK | OK | OK |
| S03 size limits: 256 KiB, 256 KiB+1, 1 MiB, 1 MiB+1 | botocore SQS doc: "maximum allowed individual message size ... 1 MiB 1,048,576 bytes"; `MaximumMessageSize` "Default: 1,048,576 bytes (1 MiB)". AWS raised the limit from 256 KiB to 1 MiB on 4 Aug 2025 ([AWS What's New](https://aws.amazon.com/about-aws/whats-new/2025/08/amazon-sqs-max-payload-size-1mib), [China-region mirror](https://www.amazonaws.cn/en/new/2025/amazon-sqs-increases-maximum-message-payload-size-to-1mib/), [Classmethod](https://dev.classmethod.jp/en/articles/sqs-max-payload-size-1mb/)) | OK (accepts 1 MiB, rejects 1 MiB+1) | DIFF (rejects 256 KiB+1 with `InvalidAttributeValue`) | OK |
| S03b default `MaximumMessageSize` attribute | 1048576 | OK | DIFF (attribute not returned) | OK |
| S04 DLQ redrive, maxReceiveCount=2 | after 2 receives message moves to DLQ, 3rd receive on source empty | OK | OK | OK |
| S04b receive count on DLQ copy | informational; all three report 3; no doc statement found, not scored | n/a | n/a | n/a |
| S05 DelaySeconds=2 | invisible 2 s | OK | OK | OK |
| S06 long poll 2 s on empty queue | returns after about 2 s | OK | OK | OK |
| S07 batch of 11 entries | `TooManyEntriesInBatchRequest` | OK (legacy code `AWS.SimpleQueueService.TooManyEntriesInBatchRequest`) | OK | OK (legacy code form) |
| S08 `MaxNumberOfMessages=11` | `InvalidParameterValue` | OK | DIFF (`InvalidAttributeValue`) | OK |
| S09 nonexistent queue | `QueueDoesNotExist` (accepted legacy `AWS.SimpleQueueService.NonExistentQueue`) | OK (legacy code) | OK (`QueueDoesNotExist`) | OK (legacy code) |
| S10 FIFO order and group blocking while in flight | a0,a1,a2 in order; second receive returns nothing for that group | OK | OK | OK |
| S11 MD5 of body and attributes | md5("hello")=5d41402a... | OK | OK | OK |
| S12 delete with stale receipt handle after redelivery | botocore SQS doc states using an older handle "might succeed, but the message might not be deleted" (i.e. no error) | OK | DIFF (`ReceiptHandleIsInvalid` 400) | OK |
| S12a redelivery after 1 s visibility timeout, checked at 1.5 s | redelivered | OK | OK | DIFF (not yet redelivered) |
| S13 FIFO queue name without `.fifo` | rejected | OK | OK (`InvalidAttributeName`) | OK |
| S14 PurgeQueue | empty | OK | OK | OK |
| **Total (scored 18)** | | **18/18** | **14/18** | **17/18** |

Visibility expiry precision (`probe_sqs_vt_timing.py`, polling every 50 ms; seconds until redelivery, 4 trials):
- VT=1 s: Moto 1.01 to 1.03; ElasticMQ 1.04 to 1.05; LocalStack 1.72, 1.94, 1.99, 1.99.
- VT=2 s: Moto 2.02 to 2.04; ElasticMQ 2.03 to 2.05; LocalStack 2.94 to 3.04.
- So LocalStack's SQS expiry appears to be checked on a coarse (about 1 s) tick: messages reappear up to about 1 s late. Anything asserting timing within a second will be flaky on LocalStack.

Lambda (Moto server + Docker Hub image, python3.8; LocalStack Failed; `probes_lambda.py`):

| Probe | Expected (source) | Moto | LocalStack |
|---|---|---|---|
| L01 handler raises ValueError | HTTP 200, `X-Amz-Function-Error` header set (botocore doc: Handled/Unhandled), payload with errorType/errorMessage/stackTrace | DIFF: payload shape right (errorType ValueError, errorMessage boom, stackTrace), but `FunctionError` = `Handled` where an uncaught exception is `Unhandled` in AWS (unverified; botocore doc defines the header values) | unsupported (function stuck in Failed) |
| L02 Timeout=2 s, handler sleeps 6 s | Task timed out message, FunctionError | PARTIAL: message "Task timed out after 2.00 seconds" present, `Handled`; wall time 21.5 s (container start dominates) | unsupported |
| L03 sync payload > 6 MB | 413 `RequestTooLargeException`; botocore doc: "For synchronous invocations, the maximum payload size is 6 MB. For asynchronous invocations, the maximum payload size is 1 MB" | DIFF: HTTP 200 with body `exec /var/rapid/init: argument list too long` | unsupported |
| L04 invalid JSON payload | 400 `InvalidRequestContentException` | DIFF: HTTP 500 HTML error page | unsupported |
| L05 missing function | 404 `ResourceNotFoundException` | OK | OK-unprobed (not run) |
| L06 `InvocationType=Event` | 202 immediately | DIFF in behaviour: status 202 correct but call blocked 19.2 s (not asynchronous) | unsupported |

Moto Lambda score: 2 of 6 fully match (L05, L06 status code), the rest differ or partial. Not scored for LocalStack (blocked, not wrong).

### Inferences
- Moto is a good functional fake for DynamoDB happy paths but under-validates (several inputs real DynamoDB rejects are accepted), so tests passing on Moto can fail on AWS. DynamoDB Local/LocalStack validate strictly. This follows from LocalStack's DynamoDB being DynamoDB Local; their results are not independent.
- Anyone relying on the 2025 SQS 1 MiB limit should not use ElasticMQ 1.6.11 (still 256 KiB); Moto and LocalStack follow the new limit.
- LocalStack's visibility-timeout tick (up to about 1 s late) and ElasticMQ's strict stale-receipt-handle error are concrete spots where retry/idempotency logic can behave differently locally.
- A Lambda test that only checks the HTTP status code passes falsely on Moto without Docker (it returns 200 with a docker error string).

### Gaps
- FIFO dedup 5-minute expiry not tested (needs >5 min wall clock); throughput quotas, throttling (`ProvisionedThroughputExceededException`), streams, TTL, PITR not probed.
- Exact AWS error-message strings for D08, D09, D10, D16 and D06 are from memory of real AWS behaviour, not from a fetched doc; I could not reach docs.aws.amazon.com. Error codes and limits cited above are doc-backed; message text mostly is not. Re-run the scripts against real AWS (endpoint `aws`) to settle this.
- The AWS docs for the `X-Amz-Function-Error` value on uncaught exceptions and the 413 name were only checked in botocore's model (shape `RequestTooLargeException` exists); not the live docs.
- Lambda on LocalStack and newer Moto runtimes untested because the AWS Lambda images could not be pulled.
- S04b (receive count on DLQ messages): no doc found.

## 4. Reproducibility: scripts and how to rerun against real AWS

### Cited Findings (files)
All under `/tmp/claude-0/-home-user-agents/4aafdca6-ae8f-5b36-81e1-5c664f9ede2c/scratchpad/exp1/` (venv at `venv/`, Python 3.13):
- `common.py`: client factory, endpoint via argument; endpoint `aws` (or empty) uses the real default credential chain and region (`AWS_REGION`, default us-east-1); emulators get dummy credentials.
- `startup_time.py <name> <port> <dynamodb|sqs> -- <cmd...>`: cold-start timing (env `N` runs).
- `bench.py <label> <ddb|sqs|lambda> <endpoint> [N]`: latency (p50/p99/mean/ops per s). Lambda mode env: `LAMBDA_ROLE`, `LAMBDA_CREATE_ROLE=1` (emulators only), `LAMBDA_RUNTIME`.
- `bench_sqs_shallow.py <label> <endpoint> [N]`, `bench_inprocess_moto.py`: shallow-queue SQS and Moto in-process numbers.
- `probes_ddb.py`, `probes_sqs.py`, `probes_lambda.py` `<label> <endpoint|aws>`: accuracy probes, each writes `probes_<svc>_<label>.json` with `expect`, `observed`, `match`. They create resources prefixed `pr_` / `prsqs-` / `pl-`; queues and tables are mostly not deleted on real AWS, so clean up after a real run, and note probes cost real money for a few requests (and SQS probes wait about 1 to 2 minutes).
- `probe_sqs_vt_timing.py <label> <endpoint>`: redelivery timing.
- `ls_launch.py`, `ls_install.py`, `start_ls.sh`: LocalStack-without-Docker workarounds for this sandbox (patch the DynamoDB Local download URL to the S3 mirror).
- Raw outputs: `bench_*.json`, `bench_sqs_shallow.jsonl`, `vt_timing.txt`, `probes_*.json`.
- Note for real-AWS reruns: the `match` flags encode expectations; messages marked "unverified" above may need correcting to what real AWS returns, which is exactly what the first real run will show.

### Gaps
- Real AWS was never run. All "matches AWS" statements mean "matches the doc statement or my stated expectation", not "was compared with AWS output".
