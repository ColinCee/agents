# Experiments: event routing, event-source-mapping wiring and IAM enforcement in local AWS emulators, and an event-ruler prototype

All numbers below were measured in this session. Scripts and raw outputs live in `/tmp/claude-0/-home-user-agents/4aafdca6-ae8f-5b36-81e1-5c664f9ede2c/scratchpad/exp2` (call it `$EXP`). No AWS credentials were available, so "correct" means the documented AWS behaviour, cross-checked against aws/event-ruler as the reference matcher.

**Machine and versions**
- Hardware: 4 vCPU Intel Xeon @ 2.80 GHz, 16 GB RAM, Linux 6.18 (Firecracker VM).
- Runtimes: OpenJDK 21.0.12, Python 3.13.16, Node 22.22.0, Maven at /opt/maven.
- Docker: the CLI exists but there is no daemon (`/var/run/docker.sock` is missing). Anything that needs containers could not run.
- event-ruler 2.2.0 from Maven Central (`software.amazon.event.ruler:event-ruler`, latest per maven-metadata.xml).
- Moto 5.2.4.
- LocalStack: `localstack-core` 4.14.0 run in host mode. The 2026.8.2 `localstack` CLI refused to start without an auth token ("License activation failed ... No credentials were found"). It was also unable to reach `api.localstack.cloud`, which the egress proxy blocked.

**Blockers**
- `docs.aws.amazon.com` is unreachable from this sandbox (curl returns 000, WebFetch gives ENOTFOUND). AWS docs claims below come from search snippets or from the event-ruler README, and are labelled as such.
- No Docker daemon, so Lambda code cannot execute in Moto or LocalStack. Event-source mapping tests therefore replace Lambda execution with a recorder. They test the dispatch logic, not Lambda itself.

---

## 1. How accurately do existing emulators match EventBridge patterns (event-ruler as ground truth)?

### Takeaway
On 57 hand-built cases, Moto 5.2.4 agreed with event-ruler 2.2.0 on 56 and LocalStack 4.14.0 on 55. Event-ruler matched my reading of the AWS docs on all 57, via both `Ruler.matchesRule` and `Machine.rulesForJSONEvent`. Core operators are handled well by both emulators. The gaps are in sub-edge-cases, and in LocalStack's case in robustness: one rule can crash event processing for other rules.

### Cited Findings
- Case set: 57 cases in `$EXP/cases.py` (output `cases.json`). They cover prefix, suffix, wildcard (including escaped `\*`), anything-but (string, list, number, prefix, suffix, wildcard, equals-ignore-case, list of prefixes, missing field), numeric ranges and type mismatches, exists true/false on missing vs null, null vs empty string, IPv4/IPv6 CIDR, `$or`, array-element matching, nested objects, array-of-objects cross-element matching, and boolean/number-vs-string literals.
- Ground truth: event-ruler returned the result I expected from the docs for all 57. Raw output is in `$EXP/ruler_out.json`, produced by `$EXP/ruler/Run.java`.
- Moto, run end to end (put_rule → SQS target → put_events, with the pattern wrapped under `detail`): 56/57 agree with event-ruler. The single mismatch is `nested-arr-obj`. For the event `{"d":[{"a":1,"b":2},{"a":3,"b":4}]}` and the pattern `{"d":{"a":[1],"b":[2]}}`, event-ruler matches (both fields in the same array element) and Moto does not. Moto does correctly reject the cross-element case. Scripts: `$EXP/moto_cases.py`, `$EXP/score.py`; output `moto_out.json`.
- Moto's `TestEventPattern` API is a stub. `models.py` has `def test_event_pattern(self): raise NotImplementedError()` and the response handler is `pass`. The `test_event_pattern` call therefore cannot be used as an oracle in Moto, and I used real routing instead.
- LocalStack 4.14.0, end to end to SQS (`$EXP/ls_cases.py`, output `localstack_out.json`): 55/57 agree with event-ruler once rules are deleted between cases. Mismatches:
  - `wild-escape`: pattern `{"wildcard":"a\\*b"}` against the value `a*b`. Event-ruler matches, LocalStack does not (escaped-star handling).
  - `nested-arr-cross`: array-of-objects pattern where the fields come from different array elements. Event-ruler correctly does not match; LocalStack does. This is a false positive, the more dangerous direction.
- LocalStack robustness bug (first, un-cleaned run, kept as `$EXP/localstack_out_run1_rules_not_cleaned.json` and `$EXP/ls_run1.log`): a rule using `{"prefix":{"equals-ignore-case":"us-"}}` throws `AttributeError: 'bool' object has no attribute 'lower'` (and likewise for `'int'`) at `event_rule_engine.py:109` when a later event carries a bool or number at that path. The exception aborted rule processing for the event. Left-over rules therefore caused extra false results (6/57 mismatches instead of 2/57), including a connection failure at the end. Real AWS treats a non-string value as a non-match for prefix. This is a lesson about test isolation, but also a real LocalStack defect.
- Sources for expected behaviour:
  - AWS's comparison-operators page lists exists true/false as separate operators and `[null]` as a literal null match ([AWS docs, via search result](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html)).
  - Event-ruler README lists the supported matchers: exact, prefix, suffix, equals-ignore-case, wildcard with escaping, anything-but variants, numeric, CIDR v4/v6, exists, `$or`. Its `exists` applies to leaf nodes only ([event-ruler README](https://github.com/aws/event-ruler)).
- Event-ruler speed (`$EXP/ruler/Bench.java`; JIT warmed, single thread, `Machine.rulesForJSONEvent`, 1 KB-ish events):

  | Workload | Rules | Events/sec |
  |---|---|---|
  | complex rules (prefix + numeric + anything-but + CIDR) | 1 | 133,699 |
  | complex | 10 | 107,896 |
  | complex | 100 | 24,320 |
  | complex | 1,000 | 2,958 |
  | simple rules (exact source/detail-type/region + prefix) | 10 | 201,315 |
  | simple | 1,000 | 322,129 |
  | simple | 10,000 | 92,181 |

  The README's own claim is "over 220K/second", with slower numeric (120K/s) and complex array (35K/s) cases, measured on a 2019 MacBook ([README](https://github.com/aws/event-ruler)). My numbers are the same order of magnitude.
- Rule compile cost is highly workload dependent. 1,000 complex rules (each with a distinct numeric threshold and CIDR) took 48.9 s to add. 100 took 1.2 s, and 10,000 simple rules took 0.3 s. A first 10,000-complex-rule run did not finish within about 10 minutes, so it was killed. Files: `bench_small.txt`, `bench_big.txt`, `bench_simple.txt`.
- Moto matching speed (`$EXP/moto_speed.py`): about 43,000 events/sec for one rule with a matching event, using `EventPattern.matches_event` directly. Matching in Moto is a linear scan over rules, so it falls proportionally as rules are added. I did not measure that scaling.

### Inferences
- For plain routing (source, detail-type, simple detail filters) Moto is good enough that a team is unlikely to hit a wrong answer. The risk is concentrated in less-common operators.
- Reusing event-ruler removes the whole class of pattern-semantics bugs, since it is AWS's own matcher. This assumes event-ruler matches production EventBridge, which I could not verify (the README does not name EventBridge as a user, and I did not find a source confirming it).
- Event-ruler's build cost for many distinct numeric/CIDR rules is a design caution for a simulator. Typical local rule sets (tens of rules) are cheap. Rule sets in the thousands with varied numeric thresholds are not.
- The 57 cases were chosen by me and mostly mainstream, so the 98% and 96% agreement figures are upper bounds for exotic patterns.

### Gaps
- No ground truth from real EventBridge, since no credentials exist. The expected column is my reading of the docs, partly from search snippets because docs.aws.amazon.com was unreachable.
- Not confirmed: whether anything-but-with-null and multi-value anything-but-prefix behave as the third-party blog described. A search snippet says the blog states AND semantics for multiple prefixes, but the AWS page was not readable.
- The latest LocalStack (2026.x) was not testable. Only 4.14.0 was used, and getting it to run required pinning `cbor2<5.8`, `pyOpenSSL<25`, `cryptography==44.0.3`, `service_identity<25` and `joserfc<1.5`. This is evidence that the OSS wheel has bit-rotted against current PyPI.
- The LocalStack run used `LOCALSTACK_DISABLE_EVENTS=1`. Its analytics calls to `analytics.localstack.cloud` were blocked by the proxy anyway.

---

## 2. Event source mapping semantics (SQS → Lambda, DynamoDB Streams → Lambda)

### Takeaway
Moto 5.2.4 implements ESMs as a thin push hook. Each SQS message or DynamoDB stream record triggers one invocation, immediately at send time. Batch size, the batching window, `ReportBatchItemFailures`, retries, and the `maxReceiveCount`-to-DLQ flow driven by Lambda failures are all ignored or only stored as configuration. LocalStack has a real poller design with partial-batch and retry code, but Lambda cannot execute without Docker, so I could only read its code and create mappings.

### Cited Findings
- Method (`$EXP/moto_esm.py`, output `moto_esm_out.json`): Lambda execution needs Docker, so I replaced `LambdaBackend.invoke` and `LambdaFunction.invoke` with a recorder. Everything upstream of the invoke (SQS and DynamoDB Streams dispatch, ESM bookkeeping) is Moto's real code.
- Batching: I sent 25 messages to a queue whose ESM had `BatchSize=10` and `MaximumBatchingWindowInSeconds=5`. Result: 25 invocations, each with exactly 1 record, and the queue ended empty. AWS would batch up to 10. Source: `sqs/models.py` calls `receive_message(... esm.batch_size ...)` inside `Queue.add_message`, but the Lambda side (`_send_sqs_message`) builds one `Records` entry per message.
- Record fidelity: `ApproximateReceiveCount` is hard-coded `"1"`, `SentTimestamp` is hard-coded `"1545082649183"`, `md5OfBody` is the constant `098f6bcd4621d373cade4e832627b4f6`, and `messageAttributes` is always `{}` (confirmed both in the output and in `awslambda/models.py` `_send_sqs_message`).
- Failure and retry: with a function that always fails, a single message was invoked once, and 3 seconds later (visibility timeout 1 s) there was still 1 invocation and the message still in the queue. Moto resets visibility to 0 on failure but nothing polls again, so there is no automatic retry. Redelivery only happens when another message is sent.
- Partial batch response: the recorded function returned `{"batchItemFailures":[{"itemIdentifier":<id>}]}` with `FunctionResponseTypes=["ReportBatchItemFailures"]`. Moto deleted the message anyway (0 left), because success is judged only by the `x-amz-function-error` header. The configuration value is stored but never consulted. AWS would retain the reported message. The Moto code path is in `send_sqs_batch`.
- DLQ: with `RedrivePolicy` `maxReceiveCount=2` and an always-failing function, the first send produced 1 invocation and 0 messages in the DLQ. After 4 manual `receive_message` calls the message reached the DLQ. So the redrive is implemented as an SQS queue feature (receive-count based), but the Lambda failure path never drives it by itself.
- DynamoDB Streams: with `BatchSize=100` and `BisectBatchOnFunctionError`/`MaximumRetryAttempts` set, 7 writes (5 puts, 1 update, 1 delete) produced 7 invocations with 1 record each. Event names were `INSERT`×5, `MODIFY`, `REMOVE`. A failing write produced exactly 1 invocation with no retry, bisect or on-failure destination. Source: `dynamodb/models/table.py` calls `send_dynamodb_items` for each stream record and clears its buffer if the invoke result is truthy; a failure payload is also truthy.
- Moto stores the ESM options (`MaximumRetryAttempts`, `BisectBatchOnFunctionError`, `ParallelizationFactor`, `FilterCriteria`, etc. in `awslambda/models.py`), so API calls succeed and configuration round-trips even though behaviour is not simulated.
- LocalStack 4.14.0, executed: `create_function` ended in state `Failed` ("Failed to pull Docker image because Docker is not available ...", from `ls2.log`). `create_event_source_mapping` still returned 202, state Creating, with `BatchSize=10` and `FunctionResponseTypes=['ReportBatchItemFailures']` echoed (`$EXP/ls_esm.py`). No message flow could be tested.
- LocalStack 4.14.0, read from source only (`localstack/services/lambda_/event_source_mapping/pollers/`): there are separate `sqs_poller.py`, `dynamodb_poller.py`, `kinesis_poller.py` and a shared `stream_poller.py`. They handle `batchItemFailures` parsing (`poller.py`), `MaximumRetryAttempts` and record-age bisecting (`stream_poller.py`), and a comment says "AUTOMATIC_BISECT upon partial batch item failure is not yet implemented. Retrying the entire batch." Another comment says `BisectBatchOnFunctionError` is "not implemented", and `MaximumBatchingWindowInSeconds` flush is a TODO for streams. This describes the code, not verified runtime behaviour.

### Inferences
- A user testing partial-batch or retry handling against Moto gets false confidence: a handler that always fails looks "fine" because nothing redelivers it, and a handler returning `batchItemFailures` has its failed items silently dropped.
- An event-source-mapping poller that reads from a queue/stream, batches, honours `batchItemFailures`, and drives retries and redrive is the main piece that is missing from Moto. LocalStack has more of it, but its Lambda executor ties it to Docker.
- A simulator that lets Lambda handlers be plain local functions would sidestep the Docker blocker.

### Gaps
- I could not run LocalStack's ESM behaviour (no Docker). Its source comments are the only evidence.
- Real AWS timing and batching-window behaviour was not measured and I did not fetch the AWS ESM docs (docs.aws.amazon.com blocked).
- Kinesis ESMs and SNS/other triggers were not tested.

---

## 3. IAM enforcement (Moto, LocalStack, policy evaluators)

### Takeaway
Neither Moto nor LocalStack community enforces IAM by default: an explicit `Deny` is ignored and calls succeed. Moto has opt-in enforcement that handles actions, resources, `NotAction` and explicit deny, but ignores `Condition` and `NotResource`, and treats action names as case-sensitive. A standalone evaluator (`@cloud-copilot/iam-simulate`) matched all 14 documented-semantics cases, but it is AGPL-licensed.

### Cited Findings
- Moto default (`$EXP/moto_iam.py`): a user with Allow `sqs:*` plus Deny `sqs:DeleteQueue` could delete the queue (`ALLOWED`), and could call `ec2:DescribeInstances` with no Allow at all (`ALLOWED`).
- Moto with enforcement on (`@set_initial_no_auth_action_count`): the same calls were denied. DeleteQueue came back as error code `403` and EC2 as `AccessDenied`. The count is the number of leading API calls (across all callers) that skip auth, so setup calls must be counted. My first run used the wrong count and enforced nothing, which is an easy mistake.
- Moto enforcement vs documented semantics (`$EXP/moto_iam2.py`, 14 cases, SQS, output `moto_iam2_out.txt`): 10/14 match. Mismatches:
  1. `Deny` with a false Condition (`aws:RequestedRegion` = `eu-west-1`, request in us-east-1) was applied. AWS would not apply it, so the call should be allowed. Moto denied.
  2. `Allow` with a false Condition gave permission. AWS grants nothing there. Moto allowed.
  3. `Deny` with `NotResource` did not apply to a non-excluded queue. Moto allowed where AWS denies.
  4. `Allow` with mixed-case `SQS:SENDMESSAGE` was refused. AWS treats action names as case-insensitive; the IAM Action docs say the prefix and name are case-insensitive, with `iam:ListAccessKeys` equal to `IAM:listaccesskeys` (reported via search result of the [AWS IAM Action reference](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_action.html); I could not open the page itself).
  Correct in Moto: explicit deny beats allow, implicit deny, `NotAction` in Allow and in Deny, resource wildcards (`arn:aws:sqs:*:*:team-*`), exact-ARN deny.
- LocalStack 4.14.0 community (`$EXP/ls_iam.py`): a user with an attached `Deny sqs:*` policy created a queue successfully (`ALLOWED`). The only occurrence of `ENFORCE_IAM` in the installed OSS package is in `runtime/analytics.py`, i.e. it is not implemented in the community code.
- Standalone evaluator: `@cloud-copilot/iam-simulate` 0.1.173 ([npm](https://www.npmjs.com/package/@cloud-copilot/iam-simulate)). It supports identity and resource policies, SCPs, RCPs, permission boundaries and all condition operators, and explains which statement decided. Result on the same 14 cases: 14/14 match (`$EXP/npm/iam_eval.mjs`, output `iam_simulate_out.txt`), returning `Allowed`, `ImplicitlyDenied` or `ExplicitlyDenied`. Licence is AGPL-3.0-or-later (from its package.json), which matters for embedding.
- Documented evaluation logic that the 14 expectations follow: default deny, explicit deny overrides allow, an allow is needed. I could not fetch the page ([evaluation logic](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html)) and encoded this from background knowledge, so the expected column was written by me, not independently sourced.

### Inferences
- The "deny does nothing locally" default means IAM bugs usually first appear in real AWS. Opt-in enforcement exists in Moto but only partly matches AWS because it skips conditions.
- Policy evaluation looks like the most separable piece to reuse: it needs only a request context and a policy set, not any service emulation. A prototype could call an existing evaluator before each emulated call.
- The 14 cases cover SQS only and one condition key. They do not test cross-account, resource policies, session policies or boundaries.

### Gaps
- No Python, Go or Java evaluator was run, only the JS one. I did not survey others such as Cedar-based or Go evaluators beyond a quick npm search.
- I did not test whether LocalStack Pro's `ENFORCE_IAM` works (no token, and it is a paid feature).
- Moto's `INITIAL_NO_AUTH_ACTION_COUNT` env var form was not tested separately from the decorator.

---

## 4. Prototype: in-process event bus on event-ruler with injectable faults

### Takeaway
A single-file Java bus (`Proto.java`, about 70 lines of logic) wires event-ruler to local handler lambdas and injects duplicates, reordering and delay. It delivers an event in a median of about 5 microseconds once warm, and is ready for the first event about 0.3 s after JVM start. Moto and LocalStack, by comparison, take hundreds of milliseconds to seconds to start and milliseconds per event through their HTTP/SDK path.

### Cited Findings
- Prototype: `$EXP/ruler/Proto.java` (compiled against the event-ruler jar in `$EXP/ruler/lib`). A `Machine` holds rules, a map of rule name → `Consumer<String>` holds handlers, and `put()` calls `rulesForJSONEvent` and delivers. Faults: duplicate probability, a reorder buffer that holds one event and releases it after the next, and a fixed delay via a scheduled executor. Seeded RNG (42). Output: `$EXP/proto_out.txt`.
- Cold start (3 runs): constructing the bus, adding one rule and delivering the first event took 282–375 ms in-JVM (class loading and first-use cost). JVM uptime at first delivery was 384–427 ms. The whole proto process, including all later phases, took about 1.29–1.30 s.
- Steady state (50,000 events after 5,000 warmup, one rule): put→handler latency p50 5.3–7.1 µs, p99 31.8–39.5 µs, max 5.5–12.8 ms (GC/JIT pauses).
- Fan-out: 1,000 rules each matching 1% of events, 20,000 events: 80,000–96,000 events/sec, with exactly 200,000 handler calls as expected. (A first version of this test had a pattern-generation bug that produced 0 calls; it was fixed and rerun.)
- Fault injection (1,000 events, dup 0.2, reorder 0.3): 1,124 deliveries, 999 unique (one event is held at the end and never released), 125 duplicates, 197 out-of-order adjacent pairs. A 50 ms delay setting produced an observed 51.7–56.5 ms put→handler.
- Comparison with the other tools (same machine):

  | Tool | Startup | Per-event latency |
  |---|---|---|
  | Prototype (Java, in-process) | ~0.3 s to first delivery in-JVM, ~0.4 s from JVM launch | p50 ~5–7 µs, direct function call |
  | Moto in-process (`mock_aws`) | import 310 ms; import + setup + first event delivered to SQS 573 ms | p50 22.5 ms, p99 46 ms for put_events + receive_message via boto3 (SDK-dominated; both calls included) |
  | `moto_server` (HTTP) | 0.445 s to HTTP ready | p50 21.1 ms, p99 51.5 ms (same two calls) |
  | LocalStack 4.14.0 host mode (7 services) | 1.32 s to health OK; first create-queue + rule + event delivered took another 1.03 s | p50 14.4 ms, p99 24.0 ms put_events → visible via receive_message |

  The per-event latency rows are not like for like: the proto measures only routing plus handler invocation, while Moto and LocalStack rows include boto3 request building, HTTP or mock transport, and a second SQS call. They show the cost of the SDK-facing path, not of matching itself.

### Inferences
- Feasibility is shown: routing with event-ruler plus local handlers needs little code, gives AWS-matching semantics for patterns, and makes fault injection trivial because delivery is a function call. Startup is dominated by JVM and class load, about 0.3–0.4 s, which is comparable to Moto's and cheaper than LocalStack's.
- The speed gap with Moto comes mostly from skipping HTTP/SDK serialisation, which an in-process API would give any implementation. It is not evidence that event-ruler matching alone is 1000× faster. The matching-only comparison is event-ruler's roughly 130K/s for one complex rule against Moto's roughly 43K/s, about 3× (different rule and event, single run, not a controlled comparison).
- A product would still need an AWS-compatible API surface (SDK calls such as `PutEvents`), which is where Moto and LocalStack spend their code. The prototype shows only the routing core.
- The reorder fault is crude: it holds one event and can lose it at the end of a run (999 unique of 1,000). A real injector would flush held events.

### Gaps
- I did not wrap the bus in an AWS-compatible HTTP endpoint, so no end-to-end SDK-call latency for the prototype exists.
- Throughput of the prototype was measured single-threaded with trivial handlers.
- JVM start was measured as process uptime and wall time, not with a multi-run statistical harness; three runs only. Python/Moto numbers are one run each.
- A GraalVM native image or a JS/Python binding for event-ruler was not tried, so the JVM requirement stays an open issue for non-Java projects.

---

## Rerun guide (all under `$EXP` = /tmp/claude-0/-home-user-agents/4aafdca6-ae8f-5b36-81e1-5c664f9ede2c/scratchpad/exp2)

- Test cases: `cases.py` → `cases.json` (57). Ground truth: `ruler/Run.java` (build: `cd ruler && javac -cp "lib/*" Run.java && java -cp "lib/*:." Run ../cases.json ../ruler_out.json`; jars from `ruler/pom.xml` via `mvn dependency:copy-dependencies -DoutputDirectory=lib`).
- Moto pattern run: `venv/bin/python moto_cases.py`; LocalStack: `./ls_start.sh` then `lsvenv2/bin/python ls_cases.py`; score both with `python3 score.py moto_out.json localstack_out.json`. Stop servers with `./killall.sh`.
- Event-ruler speed: `ruler/Bench.java` (args: rule counts, event count, optional `simple`).
- Moto speed: `moto_speed.py`, `moto_lat.py`, `moto_server_lat.py`. LocalStack: `ls_lat.py`, `ls_first.py`.
- ESM: `moto_esm.py` (Moto), `ls_esm.py` (LocalStack, shows the Docker blocker).
- IAM: `moto_iam.py`, `moto_iam2.py`, `ls_iam.py`, `iam_cases.json`, `npm/iam_eval.mjs` (run from `npm/`: `node iam_eval.mjs ../iam_cases.json`).
- Prototype: `ruler/Proto.java` (`cd ruler && javac -cp "lib/*" Proto.java && java -cp "lib/*:." Proto`).
