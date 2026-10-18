# Local AWS simulation feasibility: fidelity gaps (Lambda, EventBridge, DynamoDB+Streams, SQS, SNS, Step Functions, IAM)

Method note: docs.aws.amazon.com could not be fetched directly (DNS failure in the fetch tool), so AWS-doc facts below come from WebSearch result summaries that quote the docs; each is linked to the doc URL the search returned. Facts not verified this way are in Inferences/Gaps and labelled as unsourced.

## 1. Documented delivery, retry, ordering and limit semantics per service (what is specified and therefore reimplementable)

### Takeaway
Retry counts, windows, defaults and limits are mostly stated as exact numbers in public docs, so they can be encoded deterministically. What the docs leave unstated is timing, jitter, shard and partition layout, and delivery interleaving. Those are where a simulator has to choose a model rather than copy AWS.

### Cited Findings
- Lambda async invocation: default max event age 6 hours (configurable 60 s to 6 h), default 2 retries after a function error (configurable 0 to 2); events are then discarded or sent to a DLQ/destination. — [AWS What's New 2019](https://aws.amazon.com/about-aws/whats-new/2019/11/aws-lambda-supports-max-retry-attempts-event-age-asynchronous-invocations), [Lambda docs](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-configuring.html)
- `put-function-event-invoke-config` overwrites the whole config; `update-` changes only given options (a deploy-time gotcha). — [CLI ref](https://docs.aws.amazon.com/cli/v1/reference/lambda/put-function-event-invoke-config.html)
- Lambda quotas: timeout max 900 s; sync payload 6 MB request and response; async payload listed as 1 MB on the Lambda quotas page but 256 KB in an older General Reference version (sources conflict); scaling 1,000 concurrent executions added per 10 s per function; default regional concurrency 1,000 (adjustable); new accounts start lower. — [Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/limits.html), [older ref](https://docs.aws.amazon.com/en_gb/general/latest/gr/lambda-service.html), [newer ref](https://docs.aws.amazon.com/general/latest/gr/lambda-service.html)
- Lambda + SQS: at-least-once; guidance is visibility timeout of at least 6x function timeout plus the batch window, otherwise messages reappear mid-processing and cause duplicate invokes. Secondary sources; the 6x figure should be checked against the official page. — [OneUptime](https://oneuptime.com/blog/post/2026-02-12-trigger-lambda-sqs-queues/view), [re:Post](https://repost.aws/pt/questions/QUOIvRQGMhS_ul9c320Tg0qg/how-can-i-prevent-an-amazon-sqs-message-from-invoking-my-lambda-function-more-than-once), [Medium](https://medium.com/better-programming/sqs-batch-processing-with-reporting-batch-item-failures-6c405c852401)
- SQS standard: at-least-once, best-effort ordering. FIFO: exactly-once within a 5-minute dedup interval, strict order inside a message group, concurrent across groups; later messages in a group are withheld while one is in flight. Exactly-once holds only if the consumer deletes before visibility timeout expires and no network disruption blocks the ack. — [Codemia](https://codemia.io/knowledge-hub/path/sqs_delivering_a_message_only_once), [OneUptime 2026](https://oneuptime.com/blog/post/2026-07-22-sqs-standard-vs-fifo-exactly-once/view), [SNS FIFO dedup doc](https://docs.aws.amazon.com/en_en/sns/latest/dg/fifo-message-dedup.html)
- EventBridge target retry: default 24 hours and up to 185 attempts with exponential backoff and jitter; the 24 h cap can be hit before attempt 185; after exhaustion the event is dropped unless a DLQ is set; 5xx and 429 are retried, other 4xx are not. — [EventBridge docs](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-rule-retry-policy.html), [re:Post](https://repost.aws/knowledge-center/eventbridge-resolve-failedinvocation-errors), [Compute Blog](https://aws.amazon.com/blogs/compute/improved-failure-recovery-for-amazon-eventbridge)
- SNS: for SQS/Lambda endpoints, server-side errors are retried up to 100,015 times over 23 days; HTTP/S has a 4-phase delivery policy (immediate, minimum delay, backoff, maximum delay) with total retry time capped at 3,600 s; email/SMS/mobile push 50 attempts over 6 h; client-side errors are not retried. — [SNS retries doc (fr)](https://docs.aws.amazon.com/fr_fr/sns/latest/dg/sns-message-delivery-retries.html), [OneUptime](https://oneuptime.com/blog/post/2026-02-12-configure-sns-message-delivery-policies/view)
- DynamoDB Streams: stream record log kept up to 24 hours; sequence numbers reflect publish order; ordering is per shard (per item key in practice), not table-wide. Delivery claim conflicts across secondary sources (exactly-once vs at-least-once); official page not confirmed. — [Streams doc (cn mirror)](https://docs.amazonaws.cn/en_us/amazondynamodb/latest/developerguide/Streams.html), [Dynobase](https://dynobase.dev/dynamodb-streams/), [Codemia](https://codemia.io/knowledge-hub/path/dynamodb_stream_in-ordering_processing)
- Stream event source mappings: on error Lambda retries the batch until success or record expiry, blocking the shard; BisectBatchOnFunctionError splits the batch but does not discard the poison record; MaximumRetryAttempts (sources disagree on default: 10,000 vs infinite -1) and MaximumRecordAgeInSeconds (60 s to 7 d) unblock; on-failure destination (SQS/SNS) gets metadata only. — [AWS What's New](https://aws.amazon.com/about-aws/whats-new/2019/11/aws-lambda-supports-failure-handling-features-for-kinesis-and-dynamodb-event-sources), [Compute Blog](https://aws.amazon.com/blogs/compute/new-aws-lambda-controls-for-stream-processing-and-asynchronous-invocations/)
- DynamoDB GSI updates are asynchronous and a throttled GSI back-pressures and throttles base-table writes even if the base table has capacity. — [GSI throttling doc](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/gsi-throttling.html)
- TransactWriteItems ClientRequestToken: idempotent for 10 minutes after the first request completes; same token with different parameters returns IdempotentParameterMismatch. — [API ref](https://docs.amazonaws.cn/amazondynamodb/latest/APIReference/API_TransactWriteItems.html)
- Lambda recursive loop detection stops a request chain after 16 invocations (SQS/SNS/Lambda chains), but if the SQS redrive maxReceiveCount is above 16, SQS keeps redelivering while Lambda keeps blocking. — [Lambda docs](https://docs.amazonaws.cn/en_us/lambda/latest/dg/invocation-recursion.html), [What's New 2023](https://aws.amazon.com/about-aws/whats-new/2023/07/aws-lambda-detects-recursive-loops-lambda-functions/)
- EventBridge pattern matching is implemented in open-source aws/event-ruler: exact, prefix, suffix, equals-ignore-case, wildcard, anything-but variants, numeric, CIDR, exists, `$or`, array-consistent matching via `rulesForJSONEvent()`. Documented quirks: exists only on leaf nodes, string-only operators, dotted keys compile like nested keys (README warns may change), deprecated APIs give inconsistent results. — [event-ruler README](https://github.com/aws/event-ruler)

### Inferences
- Deterministic and fully specified (reimplementable): retry counts and windows, quotas and payload limits, FIFO group/dedup rules, pattern-matching semantics (event-ruler is the reference), TransactWrite token window, DLQ/destination routing, poison-record shard blocking.
- Specified only as a qualitative property, so the simulator must choose a model (and a test should treat all choices as valid): standard-queue duplicate and reorder frequency, backoff jitter values, stream shard split/count, GSI propagation lag, Lambda scaling and throttle timing.
- Duplicates and reordering can be simulated as adversarial schedules (inject a duplicate or reorder at every legal point), which tests the contract rather than AWS's actual rate. That is arguably stronger than reproducing the real rate.
- (Unsourced, from background knowledge, verify) Lambda cold-start latency, SQS ESM poller scaling (up to a documented max concurrency), and Express Workflow at-least-once vs Standard exactly-once execution are documented behaviors I did not retrieve in this session.

### Gaps
- Official Lambda SQS error-handling page (ReportBatchItemFailures exact semantics, e.g. what happens when the response is malformed) could not be fetched; only secondary summaries seen.
- DynamoDB Streams official delivery guarantee wording unresolved (conflicting secondary sources).
- Async payload limit conflict (256 KB vs 1 MB) unresolved; check current Lambda quotas page.
- Nothing retrieved on EventBridge event size limit (256 KB, unsourced), Step Functions Standard/Express semantics, SQS max receive/ESM scaling numbers, DynamoDB read-after-write behavior for GSI and global tables.

## 2. IAM: evaluation logic, reusable tools, failure frequency

### Takeaway
IAM policy evaluation is a documented, formally studied algorithm, and AWS has open (Cedar) and closed (Zelkova) formal tooling, so deterministic authorization checks are feasible in principle. LocalStack's own docs show how hard it is in practice: enforcement is opt-in, coverage is partial, and per-service action/resource/condition-key mapping is the real cost. I found no quantitative data on how common IAM failures are in deploys.

### Cited Findings
- Zelkova (FMCAD 2018) translates AWS policies and properties to SMT formulas; it is the engine under IAM Access Analyzer; the problem is PSPACE-complete and it is invoked millions of times daily. — [FMCAD18 paper](https://cs.utexas.edu/~hunt/FMCAD/FMCAD18/papers/paper3.pdf), [Springer chapter](https://link.springer.com/chapter/10.1007/978-3-031-13185-1_1)
- Zelkova is not open source; Cedar is. Cedar was built with verification-guided development: proofs on formal models plus differential random testing of the production code against the models. — [Cedar paper arXiv:2407.01688](https://arxiv.org/pdf/2407.01688), [Amazon Science](https://www.amazon.science/blog/how-we-built-cedar-with-automated-reasoning-and-differential-testing)
- Cedar is a different language from IAM JSON policies, so it is not a drop-in IAM evaluator. (The search result states Cedar's design; non-equivalence to IAM JSON is my reading, see Inferences.)
- LocalStack: IAM enforcement needs `ENFORCE_IAM=1`, off by default; evaluates identity-based, resource-based, permission boundary and SCP together; coverage page says not all service operations are tested; 2026.06.0 release added SCP evaluation. — [IAM enforcement docs](https://docs.localstack.cloud/aws/developer-tools/security-testing/iam-policy-enforcement/), [IAM coverage](https://docs.localstack.cloud/references/iam-coverage), [release 2026.06.0](https://blog.localstack.cloud/localstack-for-aws-release-2026-06-0/)
- Third-party claims that LocalStack lets through requests that fail on real AWS due to missing IAM policies (not official). — [re:Post](https://repost.aws/questions/QUIzeQOxW_TMW-u6DupFtwsg/limitations-of-localstack-s-emulation-within-vs-code), [AI Indigo review](https://aiindigo.com/blog/localstack-review-the-standard-for-local-aws-development-in-2026)
- IAM changes are eventually consistent (seconds) per a secondary source; no official timing retrieved. — [NHIMG](https://nhimg.org/articles/eventual-consistency-persistence-exposes-a-cloud-iam-containment-gap/)

### Inferences
- (Unsourced background, verify against the IAM evaluation-logic page, which I could not fetch) The evaluation order is: explicit deny anywhere wins; SCP/RCP and permission boundaries and session policies only restrict; same-account resource policies can grant alone, cross-account needs both sides. All of this is deterministic and specified.
- Hard part is data, not logic: action-to-resource ARN mapping, condition-key availability per action, service-specific resource policies (KMS key policies, S3 ACL/bucket policy interplay), and implicit permissions called by the service on the caller's behalf (e.g. event source mapping poller role, EventBridge target role, Step Functions task role). Botocore models give API shapes but, to my knowledge, not the authorization reference; the Service Authorization Reference is separate (not verified here).
- Simulation can check "policy as written allows action X on resource Y" deterministically. It cannot check propagation delay, or whether an AWS service makes a call you did not know about.

### Gaps
- No data found on frequency of IAM misconfiguration as a deploy failure cause; only anecdotes. Cannot rate IAM's production-bug frequency with evidence (my impression is it is one of the most common first-deploy failures, unsourced).
- Open-source IAM evaluators (e.g. policy_sentry, iam-policy-evaluator libs, Parliament) not searched.
- IAM Policy Simulator API behavior and its known gaps not retrieved.

## 3. Failure classes seen in production and what a simulator would catch

### Takeaway
The documented, repeatable failures (duplicates, visibility-timeout redelivery, poison-pill shard blocking, retry storms, recursion loops, DLQ misconfiguration) are all semantic and catchable by a faithful deterministic simulator. Capacity, throttling-at-scale, cold-start timing and cross-service propagation lag are not. I did not find a named public post-mortem for this scope; evidence is AWS docs/announcements and practitioner write-ups.

### Cited Findings
- AWS added recursive loop detection (16 invocations) because SQS→Lambda→SQS and SNS/S3 loops caused runaway cost; gap when maxReceiveCount > 16. — [Lambda docs](https://docs.amazonaws.cn/en_us/lambda/latest/dg/invocation-recursion.html), [Pointfive](https://hub.pointfive.co/inefficiencies/recursive-invocation-loop-between-lambda-and-sqs)
- Visibility timeout shorter than processing time re-delivers a message and causes duplicate side effects; fixes are idempotency (e.g. DynamoDB conditional writes) and partial batch response. — [AWS Builder post](https://builder.aws.com/content/3KXQPAK8W3CeHpPOGnoHWRBITAE/aws-lambda-and-sqs-why-retries-need-more-than-a-queue), [re:Post](https://repost.aws/questions/QUOIvRQGMhS_ul9c320Tg0qg/how-can-i-prevent-an-amazon-sqs-message-from-invoking-my-lambda-function-more-than-once)
- Stream poison record with default settings retries until expiry and blocks the shard (watch IteratorAge). — [Compute Blog](https://aws.amazon.com/blogs/compute/new-aws-lambda-controls-for-stream-processing-and-asynchronous-invocations/)
- Upstream timeout re-sends: API Gateway 30 s timeout returned 504 while Lambda kept running, sender retried, causing duplicate processing. — [Substack](https://annpastushko.substack.com/p/designing-for-failure-in-serverless)
- GSI under-provisioning throttles base-table writes. — [GSI doc](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/gsi-throttling.html)
- Misconfigured EventBridge targets: non-retried 4xx errors drop events without DLQ. — [re:Post](https://repost.aws/knowledge-center/eventbridge-resolve-failedinvocation-errors)

### Inferences
- Catchable by a deterministic simulator with adversarial scheduling: duplicate delivery, redelivery on visibility expiry, reorder on standard queues, partial batch failure mishandling, poison pill config, retry/DLQ wiring, recursion, pattern-match mistakes, IAM statically missing.
- Not catchable deterministically: throttling and concurrency limits under real load, cold-start timeouts, GSI lag in practice, account-level quota values, regional events. These need either configurable fault injection (to test the code's response, which is feasible) or real AWS (to learn whether it will happen).
- Rating (my judgement, not measured): duplicates/idempotency, retry/DLQ misconfig and IAM: frequent and simulable. Throttle/capacity and propagation timing: frequent but only partially simulable (response to injected fault yes, occurrence no).

### Gaps
- No named, dated public post-mortems (company incidents) found; no frequency statistics. Search should be repeated with specific incident names.

## 4. AWS-published artifacts that encode behavior

### Takeaway
Behavior capture varies sharply: event-ruler is a production-grade, faithful matcher; DynamoDB Local is the real engine minus distribution; Step Functions Local is explicitly unsupported and incomplete; none of these model cross-service delivery, retries, or IAM.

### Cited Findings
- event-ruler is the Java matcher (see Section 1 for operators and quirks). — [GitHub](https://github.com/aws/event-ruler)
- DynamoDB Local: reads eventually consistent in name but appear strongly consistent in practice; provisioned throughput ignored (no throttling); no table partitioning so stream shard creation differs; item collection metrics not tracked; index query size computed on full item (service uses projected size); regions/accounts not distinguished. AWS says apps should otherwise work against the service. — [Usage notes](https://docs.aws.eu/amazondynamodb/latest/developerguide/DynamoDBLocal.UsageNotes.html)
- Step Functions Local: AWS states it is unsupported, lacks feature parity (no optimized service integrations, cross-account access, distributed map) and suggests the TestState API. — [Step Functions Local doc](https://docs.aws.amazon.com/step-functions/latest/dg/sfn-local.html), [DZone](https://dzone.com/articles/aws-step-functions-local-mocking-services-http-endpoints)
- LocalStack's stated goal is behavior parity at the API call level; coverage is documented per service. — [Parity explained](https://blog.localstack.cloud/2022-08-04-parity-explained/)

### Inferences
- (Unsourced, verify) Smithy/botocore models give request/response shapes, error codes and paginators/waiters, so a simulator can validate input and error shapes cheaply; they do not encode semantics such as retries or ordering. Lambda RIE emulates the invoke API and runtime interface, not the async queue, retries or concurrency. cfn-lint/CloudFormation specs give resource schemas, not runtime behavior.
- Reusable cores: event-ruler (matcher, embeddable on JVM), DynamoDB Local (storage and expression semantics, but not throttling or real stream sharding), Cedar (policy engine, not IAM-compatible).

### Gaps
- Lambda RIE, botocore/Smithy, cfn-lint, SDK waiters/paginators capabilities not researched this session.

## 5. Deterministic simulation and formal methods literature

### Takeaway
DST is proven for systems built to be simulated (FoundationDB, TigerBeetle) and Antithesis extends it to arbitrary software by simulating at the hypervisor level. AWS's own formal work validates service internals against executable models. The transferable lesson: a faithful semantic model plus seeded fault injection finds ordering and crash bugs, but the model is only as good as its spec of the real service.

### Cited Findings
- TigerBeetle VOPR simulates a whole cluster with clock, disk and network faults, seeded and reproducible by git commit, compressing time. — [TigerBeetle docs](https://docs.tigerbeetle.com/about/vopr), [Jepsen analysis](https://jepsen.io/analyses/tigerbeetle-0.16.11.pdf)
- Antithesis runs ordinary nondeterministic software in a deterministic hypervisor; external dependencies still need mocking; building a deterministic environment is costly and not every system fits. FoundationDB's simulation underlies its approach. — [Antithesis docs](https://antithesis.com/docs/resources/deterministic_simulation_testing/)
- AWS formal methods (2015 CACM): TLA+ on ten systems found subtle bugs; a DynamoDB replication model (939 lines) found bugs with traces up to 35 steps (slides, secondary). Later CACM 2025 piece covers TLA+ plus P (state-machine language). — [CACM](https://cacm.acm.org/practice/systems-correctness-practices-at-amazon-web-services), [MIT PDF](https://6826.csail.mit.edu/2019/papers/formal-methods-amazon.pdf), [Acolyer](https://blog.acolyer.org/2014/11/24/use-of-formal-methods-at-amazon-web-services/)
- ShardStore (SOSP 2021, best paper): executable reference models as specs, property-based and stateless model checking, prevented 16 issues from reaching production, 40,000+ lines Rust. — [Paper](https://www.cs.utexas.edu/%7Ebornholt/papers/shardstore-sosp21.pdf), [Amazon Science](https://amazon.science/blog/aws-team-wins-best-paper-award-for-work-on-automated-reasoning)

### Inferences
- A cloud-service simulator is a different thing from DST of your own system: DST needs the environment (AWS) modelled; the model's correctness cannot be proven against a closed service, only differential-tested against real AWS (the Cedar/ShardStore pattern: executable model checked against the real implementation). That points to a conformance suite run against real AWS as the way to keep a simulator honest.
- Therefore fundamentally needs real AWS: validating the simulator's own fidelity, quota values, timing and scale effects, undocumented service-side behavior, IAM service-linked/implicit calls.

### Gaps
- FoundationDB paper itself and AWS P-language details not fetched; no source found on a published AWS-service simulator conformance approach.
