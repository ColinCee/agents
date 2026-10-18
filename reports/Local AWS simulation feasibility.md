# Build a local AWS simulator, but narrowly

**Verdict: feasible, if you build a "contract simulator" and not a copy of AWS.** Run the real Lambda code. Route events between a few services using the rules AWS documents (retries, visibility timeouts, redrive, pattern matching). Add a virtual clock and seeded fault injection, and record real-AWS behaviour to check the simulator against. That is worth building, because it tests failure modes that mocks and LocalStack-style emulators measurably skip. It stops being feasible the moment it has to reproduce service internals: IAM edge cases, throttling, partition behaviour, timing at scale. It will never replace real AWS entirely. It can shrink "deploy to find out" to a thin smoke test. Our experiments back this up. Moto (a Python AWS mock library) never retries a failed Lambda, ignores partial-batch failures and sends every SQS message as its own batch of one. LocalStack's open-source build ignores IAM denies. Yet a roughly 70-line prototype on AWS's own EventBridge matcher routed an event in about 5 microseconds and injected duplicates and reordering on demand. Nothing was compared against real AWS, because no credentials existed in the sandbox. "Matches AWS" below means "matches the documentation".

## The short version

| Question | Answer |
|---|---|
| Feasible? | Yes, for documented contracts. No, for AWS internals. |
| Start with | The event plumbing around Lambda (SQS and EventBridge to Lambda), not Lambda itself. Lambda already has an official runtime. |
| Biggest edge over mocks | Retries, duplicates, partial batches, DLQ routing and timeouts, with replayable seeds. |
| Biggest risk | Drift from real AWS. Fix with a recorded conformance suite, not more code. |
| Rewriting AWS? | Not if scope stays at "behaviour my app depends on". Yes if scope drifts to "AWS-compatible". |

## Existing tools are accurate on shapes and weak on behaviour

The market moved in 2026. LocalStack ended its free no-account edition on 23 March 2026, requiring an account and token ([InfoQ](https://www.infoq.com/news/2026/02/localstack-aws-community)). Chainguard is decommissioning its LocalStack image ([Chainguard](https://support.chainguard.dev/hc/en-us/articles/49369574832667-LocalStack-Image-Decommission-Notice)). A wave of open-source clones followed: Floci, MiniStack, kumo and others, all months old, with self-reported and unstable service counts ([Floci](https://floci.io/floci/), [MiniStack](https://ministack.org/)). Service count is not a fidelity measure. Floci's 1,925 passing tests show SDK compatibility, not behavioural equivalence ([codenote.net](https://codenote.net/en/posts/localstack-archived-oss-alternatives-comparison/)).

Our measurements agree. On 31 DynamoDB probes, DynamoDB Local and LocalStack (which wraps DynamoDB Local) matched the documented behaviour 30 of 31 times. Moto matched 23 of 31 and silently accepted inputs real DynamoDB rejects: a 39-digit number, number overflow, duplicate set members, a GSI key of the wrong type, and 26 items in a BatchWriteItem. On 18 SQS probes, Moto scored 18/18, LocalStack 17/18 and ElasticMQ 14/18. ElasticMQ still enforces the old 256 KiB limit, while AWS moved to 1 MiB in August 2025 ([AWS](https://aws.amazon.com/about-aws/whats-new/2025/08/amazon-sqs-max-payload-size-1mib)). LocalStack redelivered messages up to about 1 second late, so timing assertions would be flaky there.

Plain request/response shapes are therefore in good shape. Behaviour across services is where the tools fail. For EventBridge patterns we built 57 test cases and used AWS's open-source matcher, event-ruler 2.2.0, as ground truth. Moto agreed on 56 and LocalStack 4.14.0 on 55. LocalStack's miss is the dangerous kind: it matched an array-of-objects pattern across different array elements, a false positive. A rule with `equals-ignore-case` inside `prefix` also crashed LocalStack's event processing when a later event carried a number or boolean at that path.

The sharpest gap is event-source mappings, the glue between queues or streams and Lambda. Moto fires one Lambda per message immediately. In our test, 25 messages with `BatchSize=10` produced 25 invocations of 1 record each. A function that always fails was invoked once and never retried. A handler returning `batchItemFailures` had the failed message deleted anyway. Stream records behave the same way: 7 writes gave 7 single-record invocations with no retry or bisect. `ApproximateReceiveCount` is hard-coded to "1". A team testing retry or idempotency logic on Moto gets false confidence. LocalStack has real poller code, but its own source comments call bisecting and the stream batching window not implemented. We could not run it, because its Lambda needs Docker and the sandbox could not pull AWS's Lambda images.

IAM is the other hole. Moto and community LocalStack let an explicit Deny through by default. Moto's opt-in enforcement matched 10 of 14 cases and ignores `Condition` and `NotResource`. LocalStack's enforcement is a paid feature ([LocalStack docs](https://docs.localstack.cloud/aws/capabilities/security-testing/iam-policy-enforcement)).

## Measured speed: the simulator's edge is skipping the HTTP layer

All numbers below come from our sandbox: 4 vCPU, one sequential boto3 client, loopback HTTP. They are indicative, not isolated benchmarks.

| Tool | Cold start | DynamoDB put p50 | SQS send p50 |
|---|---|---|---|
| Moto in-process | 0.66 s | 0.97 ms | 5.9 ms |
| Moto server | about 0.6 s | 3.9 ms | 11.1 ms (4.5 ms on an empty queue) |
| DynamoDB Local (Java) | 3.2 to 3.4 s | 3.1 ms | n/a |
| ElasticMQ (Java) | 2.2 to 2.7 s | n/a | 3.9 ms (2.3 ms empty) |
| LocalStack core, no Docker | about 3.8 s | 10.6 ms | 3.2 ms |

Moto's SQS receive slows as the queue grows: 29 ms at depth up to 1,000 versus 4.9 ms at depth 1. Lambda was the failure. Moto with Docker took about 21 s per invoke, and that is an upper bound because Docker here used a slow storage driver. Without a Docker daemon, Moto returned HTTP 200 with an error string as the payload, so a test that checks only the status code passes falsely.

The prototype shows where the gain lies. It wires event-ruler to plain local functions. Cold start to first delivery was 0.28 to 0.38 s, with p50 routing latency of **5 to 7 microseconds** and p99 of 32 to 40 microseconds. Fan-out across 1,000 rules ran at 80,000 to 96,000 events a second. Moto and LocalStack measured 14 to 23 ms per event, but that includes SDK and HTTP overhead and a second SQS call, so it is not a like-for-like comparison. The honest reading: an in-process API removes the SDK round trip, and any implementation could do that. Matching speed alone is only about 3 times faster (event-ruler about 130,000 events a second against Moto about 43,000, one uncontrolled run). One caution: event-ruler compiled 1,000 complex rules (distinct numeric thresholds plus CIDR) in 49 s, and 10,000 such rules never finished. Typical local rule sets of tens of rules are cheap.

## What can and cannot be simulated

The dividing line is whether AWS publishes the behaviour as a number or rule. Retry counts, windows and limits are mostly stated exactly in the docs, so they can be encoded deterministically. Examples: Lambda async invocation defaults to 2 retries and a 6-hour event age ([AWS](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-configuring.html)). EventBridge retries for up to 24 hours or 185 attempts ([AWS](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-rule-retry-policy.html)). Recursive loop detection stops a chain at 16 invocations ([AWS](https://docs.amazonaws.cn/en_us/lambda/latest/dg/invocation-recursion.html)). FIFO queues use a 5-minute dedup window and per-group ordering. Stream poison records block a shard until they expire or are skipped ([AWS](https://aws.amazon.com/blogs/compute/new-aws-lambda-controls-for-stream-processing-and-asynchronous-invocations/)). Timing, jitter, shard layout and delivery interleaving are not stated, so a simulator must choose a model.

That choice turns out to be a strength. Instead of copying AWS's real duplicate rate, the simulator can inject a duplicate or reorder at every legal point. That tests the contract your code must survive, which real AWS cannot do repeatably.

| Class | Simulate deterministically | Needs real AWS |
|---|---|---|
| Delivery | Duplicates, redelivery on visibility expiry, reorder, partial batch failure, DLQ and redrive, retry windows | Real duplicate rates, backoff jitter values |
| Routing | EventBridge patterns (embed event-ruler), rule-to-target wiring | Cross-account and regional event quirks |
| Data | DynamoDB expressions, conditions, transactions, size limits (wrap DynamoDB Local) | Throttling, partition behaviour, GSI lag, transaction conflicts. DynamoDB Local omits these too ([AWS](https://docs.aws.eu/amazondynamodb/latest/developerguide/DynamoDBLocal.UsageNotes.html)) |
| Compute | Handler logic, event shapes, timeouts via virtual clock | Cold starts, memory limits, concurrency scaling, VPC, the real sandbox |
| Security | "Does the policy as written allow action X on resource Y" (an evaluator matched 14/14 of our cases) | Calls AWS makes on your behalf you did not know about, propagation delay, KMS and service-linked roles |
| Deploy | Static wiring checks of the synthesized template | Quotas, name conflicts, deploy-time permission errors |

IAM evaluation is the most separable piece. `@cloud-copilot/iam-simulate` matched all 14 of our cases, but it is AGPL-licensed, which matters if you embed it. Evaluation order is background knowledge here, not a fetched source. Cedar is not a drop-in IAM evaluator, and Zelkova is closed ([Cedar paper](https://arxiv.org/pdf/2407.01688)). The hard part of IAM is data, not logic: mapping every action to resources and condition keys, and implicit service-to-service calls.

## Other industries solved this by pairing a model with an oracle

Every mature field builds a fast model and then proves the model against something real. None of them skips the second step.

- **Chips.** Verification runs the real design against an independent reference model through a "scoreboard" that compares predicted and actual outputs. The reference model deliberately trades timing precision for speed ([Verification Academy](https://verificationacademy.com/verification-horizons/november-2015-volume-11-issue-3/a-generic-uvm-scoreboard/), [DVCon paper](https://dvcon-proceedings.org/wp-content/uploads/versatile-uvm-scoreboarding-us-paper.pdf)). Your Lambda code is the design under test. The simulator is the reference environment.
- **Cloudflare.** Miniflare 2 reimplemented the runtime and drifted. Miniflare 3 runs workerd, the production runtime, and simulates only the bindings ([Cloudflare](https://blog.cloudflare.com/miniflare-and-workerd)). AWS offers no open production substrate, so the equivalent is running real Lambda runtime code and simulating only the services around it.
- **FoundationDB and TigerBeetle.** Deterministic simulation puts the network, disk and clock under a seeded random generator. Failures replay from a seed plus a git commit, and TigerBeetle says one minute of simulation equals days of real testing ([TigerBeetle](https://docs.tigerbeetle.com/about/vopr)). The catch is that these teams own the code they simulate. Here AWS is the unowned part, so you get repeatable fault injection against your own logic, not proof that AWS behaves like the model.
- **AWS itself.** Cedar was built with proofs plus differential testing of the production code against an executable model ([Amazon Science](https://www.amazon.science/blog/how-we-built-cedar-with-automated-reasoning-and-differential-testing)). ShardStore used executable reference models and prevented 16 issues from reaching production ([paper](https://www.cs.utexas.edu/%7Ebornholt/papers/shardstore-sosp21.pdf)). PObserve checks real logs against specifications ([CACM](https://cacm.acm.org/practice/systems-correctness-practices-at-amazon-web-services)). The portable lesson is to record real behaviour and diff against it. LocalStack already does this with snapshot tests: run against real AWS, store the response, replay against the emulator ([LocalStack](https://docs.localstack.cloud/contributing/parity-testing/)). We found no 2026 clone publishing such suites. fakecloud generates tests from Smithy models, which check serialization shape, not behaviour, and its counts are self-reported ([lib.rs](https://lib.rs/crates/fakecloud)).
- **Safety standards.** ISO 26262 and DO-330 ask how much damage a wrong tool could do and whether you would notice, not whether the tool is perfect ([Validas](https://www.validas.de/resources/glossary/tool-confidence-level), [Afuzion](https://afuzion.com/?p=358)). A simulator used as one gate among several needs little qualification. One that replaces real testing needs real evidence. So claim fidelity per operation, with a test for each claim.
- **Temporal.** Its test server skips time, so a day-long sleep finishes in seconds ([Temporal](https://docs.temporal.io/develop/typescript/testing-suite)). A virtual clock is cheap and high-value for visibility timeouts, schedules and Lambda timeouts.
- **Firebase and DynamoDB Local.** Both publish explicit lists of what they do not model ([Firestore emulator](https://docs.cloud.google.com/firestore/docs/emulator)). Do the same, and fail loudly on unsupported calls instead of accepting them silently.

The trading-industry analogy is weakest: sources were vendor pages, with no account of how firms validate their simulators. The useful part is the split between an API emulator and a behavioural model.

## Build plan: five stages, each stoppable

Stage order follows risk: pure logic first, then glue, then data, then security, then the real-AWS oracle. This is my design, extending the research findings, not something a source prescribes. Where a stage touches the "no good tool exists" test, check that Moto or Floci has not caught up first.

| Stage | Build | Done when | Cost signal |
|---|---|---|---|
| 0. Prove value | Take one real app. List the last 10 production bugs. Mark which a simulator would have caught. | At least 3 of the 10 are in the simulable column. If not, stop. | Days |
| 1. Lambda runner and wiring | Run handlers with the official runtime image or in-process. Parse the synthesized CloudFormation into a graph (source, trigger, function, role, target). Fail loudly on unmodelled resources. Add a static check for missing permissions and triggers. | A deploy-wiring bug is reported before deploy. | Docker is a blocker: this sandbox could not pull AWS's Lambda images, so support a no-Docker in-process mode |
| 2. Event plumbing | SQS (visibility, redrive, FIFO groups) and event source mapping (batching, `batchItemFailures`, retries, poison pill). EventBridge via embedded event-ruler. Virtual clock, seeded duplicate/reorder/delay/timeout injection. | A handler that fails or ignores partial batches is caught, and the seed replays it. | This is the product. Prototype exists (about 70 lines) |
| 3. Data | Wrap DynamoDB Local rather than rewrite it. Add stream records feeding Lambda. Inject throttle and conflict errors so the code's response can be tested, even though the simulator cannot predict when they occur. | Stream-to-Lambda retry and poison-record behaviour works. | JVM start 2 to 3.5 s once per suite |
| 4. Security | Call an IAM evaluator before each simulated call. Check licence (AGPL) before embedding. | Missing-permission bugs surface locally for the services in scope. | Action and resource mapping is the long tail |
| 5. Honesty layer | Record real-AWS request and response pairs. Tag each behaviour validated or unvalidated, with date and region. Replay in CI and re-record on a schedule. | Every claim in the simulator's README has a dated recording. | The snapshot corpus is the real asset, more than the code |

Do SNS and Step Functions only if the app uses them. AWS calls Step Functions Local unsupported and incomplete ([AWS](https://docs.aws.amazon.com/step-functions/latest/dg/sfn-local.html)).

Two product decisions need your call. First, language. Event-ruler is Java, so Stage 2 is cheapest on the JVM, with about 0.3 to 0.4 s of start. A non-Java host needs a port (py-event-ruler, eb-patterns and Quamina exist) or a native image, which we did not test. Second, whether to expose an AWS-compatible HTTP endpoint so unchanged SDK code works. That is where Moto and LocalStack spend most of their code, and the prototype did not build it.

## What still needs real AWS

Keep a thin smoke test in a shared dev account. It covers: IAM edge cases, KMS, resource policies and service-linked roles; cold starts, memory, concurrency and throttling at load; VPC and networking; quotas and payload limits at scale; DynamoDB partitioning and transaction conflicts; eventual-consistency and managed-retry timing; deploy-time failures; and any service outside the modelled set. Cheaper hybrids cover the gap from the other side. SST Live and Serverless dev mode run your code locally against real AWS, and hotswap and `sam sync` deploy code changes in seconds against a deployed stack. The 3 s versus 67 s CDK hotswap figure and the 5 to 10 s `sam sync` figure are from a workshop and a third-party estimate, not benchmarks ([CDK workshop](https://cdkworkshop.com/20-typescript/30-hello-cdk/300-cdk-watch.html), [OneUptime](https://oneuptime.com/blog/post/2026-02-12-sam-accelerate-faster-development-cycles/view)). They only help with code, not wiring, and wiring is where serverless bugs live.

## Conclusion

The research changed the question. "Can we emulate AWS?" has the answer no, and that is the wrong goal. The useful product is a failure-mode tester: it makes your code survive every legal duplicate, reorder, retry and timeout, which are exactly the cases the tested emulators skipped. In our runs, Moto never redelivered a failed message and LocalStack's community build ignored IAM entirely. Because delivery becomes a function call and time becomes a variable, this beats real AWS on repeatability, and real AWS cannot offer it at all.

The moat is the recorded conformance corpus and the published "not modelled" list, not the code. Stage 0 is the cheapest decision gate: if past incidents are mostly capacity, IAM or deploy errors rather than delivery semantics, the simulator will not pay off, and a hybrid tool such as SST Live is the better buy. Unresolved: whether the 57 EventBridge cases and 14 IAM cases generalize, since I chose them and they are mostly mainstream; whether LocalStack's current paid builds close the event-source-mapping gap; and how large the drift is, since nothing in this research ran against real AWS.
