# Existing tools for running/testing AWS serverless apps locally (state as of October 2026)

Method note: WebFetch failed in this session (DNS errors for every host), so no page was read in full. Findings come from WebSearch result summaries and GitHub search metadata/issue titles. Primary pages (LocalStack blog, docs) are cited as they were surfaced by search but were not opened. The report writer should treat vendor-sourced numbers as claims, not measurements.

## 1. Which tools exist, and what is their current status (LocalStack licensing, new entrants)

### Takeaway
LocalStack ended its free no-account Community Edition in March 2026 (single image, account and auth token required, free Hobby tier for non-commercial use, paid tiers for commercial use), which triggered a wave of open-source clones (Floci, MiniStack, kumo, and many smaller ones) created Feb-Oct 2026. Moto, DynamoDB Local, SAM CLI and the RIE continue to exist; Step Functions Local is documented by AWS as unsupported.

### Cited Findings
- LocalStack's blog said the Community edition would end on 23 March 2026 and be replaced by a single image requiring a user account and auth token; the community code stays on GitHub as an inactive reference with no commitment to regular updates — [LocalStack blog: The Road Ahead](https://blog.localstack.cloud/the-road-ahead-for-localstack/) (surfaced via search, not opened); [InfoQ](https://www.infoq.com/news/2026/02/localstack-aws-community)
- InfoQ: co-CEOs justified the change by the growing scope, security requirements and operational cost of maintaining high-fidelity emulation; the model keeps a free account-based entry point — [InfoQ](https://www.infoq.com/news/2026/02/localstack-aws-community)
- A secondary comparison says the localstack/localstack repo was archived on 23 March 2026 and the grace-period flag LOCALSTACK_ACKNOWLEDGE_ACCOUNT_REQUIREMENT=1 stopped working shortly afterwards — [codenote.net](https://codenote.net/en/posts/localstack-archived-oss-alternatives-comparison/) (secondary; a Chinese aggregator also says archived — [80aj.com](https://www.80aj.com/2026/03/24/localstack-aws-archive/))
- Chainguard is decommissioning its LocalStack image (last planned build change 20 May 2026), citing LocalStack's move to a closed-source model — [Chainguard notice](https://support.chainguard.dev/hc/en-us/articles/49369574832667-LocalStack-Image-Decommission-Notice)
- LocalStack docs (as of 23 March 2026): Hobby = free, non-commercial; Base, Ultimate, Enterprise = paid, commercial use. Hobby listed as 30+ services, 1 personal sandbox, CI runs, requires registration. Students (GitHub-verified), OSS projects and non-profits get special subscriptions — [LocalStack licensing docs](https://docs.localstack.cloud/aws/licensing/); [pricing blog](https://blog.localstack.cloud/2026-upcoming-pricing-changes/)
- Paid prices conflict between sources: Base $39/licence/month billed annually (55+ services) and Ultimate $89 (110+ services) in one listing; Base $45/month in another — [xlsoft listing](https://www.xlsoft.com/en/products/localstack/pricing.html); [PricingSaaS](https://pricingsaas.com/companies/localstack). Not confirmed against LocalStack's own pricing page.
- Floci (floci-io/floci): Java (Quarkus, GraalVM native), MIT, created 2026-02-18, about 26.9k stars on 2026-10-17, no account/token, port 4566; Lambda, RDS, ECS run real Docker containers; project says 68 services (other pages say 22, 41, 45, 69, 75, i.e. the count is unstable) — [GitHub search metadata](https://github.com/floci-io/floci); [Floci site](https://floci.io/floci/); [floci.io/llms.txt](https://floci.io/llms.txt)
- Floci has per-language Testcontainers modules (Java, Python, Node, Go, .NET) — [floci-io/testcontainers-floci](https://github.com/floci-io/testcontainers-floci)
- MiniStack (ministackorg/ministack): Python, MIT, created 2026-03-24, about 5.0k stars, "60+ services" in repo description (other sources say 33 or 42; the count is unstable) — [GitHub](https://github.com/ministackorg/ministack); [ministack.org services](https://ministack.org/docs/services/)
- kumo (sivchari/kumo): Go single binary or Docker, MIT, port 4566, no auth, optional persistence via KUMO_DATA_DIR; formerly "awsim", renamed March 2026 over trademark concerns; service count reported as 71, 76, 81 and 82 in different sources; README does not say how deep each service is — [dev.co](https://dev.co/testing/open-source/kumo); [wikidocs](https://wikidocs.net/blog/@jaehong/12249/); [gittrend](https://gittrend.io/repo/sivchari/kumo)
- Other 2026 entrants seen in GitHub search (all small/young, descriptions are self-reported): fakecloud, laws (Rust), hiraeth (Rust, SQLite-backed, SQS), stackd (Go, Apache-2.0, created 2026-09-11), ferristack (Rust, created 2026-07), ruststack (Rust, tagged "aislop", claims 1.6 MB memory), nimbus (Go), may (Go, created 2026-10-10), jaiscloud (Go), kumolo (Go, "high-fidelity"), bun-bunsai (Bun), LocalEmu (described as free successor to LocalStack) — [GitHub repository search](https://github.com/search?q=local+AWS+emulator); [LocalEmu article](https://aws.plainenglish.io/meet-localemu-the-free-successor-to-localstack-b9755ba6c91e)
- AWS docs state Step Functions Local is not supported, lacks parity (no optimized service integrations, cross-account access, distributed maps) and recommend the TestState API; the docker image amazon/aws-stepfunctions-local still appears in docs on port 8083 — [AWS (fr)](https://docs.aws.amazon.com/fr_fr/step-functions/latest/dg/sfn-local-lambda.md); [AWS (de)](https://docs.aws.amazon.com/de_de/step-functions/latest/dg/test-and-debug.html); [AWS China docs](https://docs.amazonaws.cn/step-functions/latest/dg/sfn-local.html)
- TestState API tests one state at a time with mocked Task results and Context object; community toolkit notes it cannot run .sync or .waitForTaskToken integrations; LocalStack says it emulates TestState locally — [LocalStack blog](https://blog.localstack.cloud/effective-unit-testing-for-aws-step-functions/); [Step Functions Toolkit](https://aws-stepfunctions-toolkit.readthedocs.io/)
- SST Live: deployed function is swapped for a stub that proxies invocations to the local machine, using AppSync Events in current docs (IoT WebSocket in older Ion docs); reuses the function's real IAM permissions; SST claims 50-100x faster than SAM Accelerate / CDK watch (vendor claim) — [SST docs](https://sst.dev/docs/live); [Ion docs](https://ion.sst.dev/docs/live)
- Third-party "real cloud, local code" tools: Lambda Live Debugger (CDK v2, Serverless v3, SAM, Terraform/OpenTofu) — [README](https://unpkg.com/lambda-live-debugger@1.12.6/README.md)
- SAM CLI `sam local start-api` starts a new Docker container per newly invoked function; one developer reports about 1 s per call (anecdotal) — [LambdaProxy](https://github.com/0x4a616e/LambdaProxy)

### Inferences
- The 2026 clones are mostly 1-7 months old, with unstable self-reported service counts; "number of services" is not a fidelity measure.
- Tools that run real code in Docker for Lambda (Floci, MiniStack, LocalStack, SAM) share the RIE-style execution model; fidelity differences concentrate in the control plane and event-source plumbing.

### Gaps
- Not verified this session: Moto's current release/status and server-mode internals, ElasticMQ status, serverless-offline status, AWS Toolkit / console Lambda remote debugging, SAM CLI release status, official Testcontainers LocalStack module status after the licensing change, cloud-hosted ephemeral options (LocalStack cloud sandboxes seen only in the Hobby plan description). No source found.
- LocalStack's exact current price page was not read.

## 2. How each tool implements services

### Takeaway
Implementation approaches found: LocalStack and Moto reimplement from scratch in Python; DynamoDB Local is AWS's own Java build; the 2026 clones reimplement in Java/Go/Rust/Python and delegate compute and databases to real Docker containers or engines; "real cloud" tools (SST Live, Lambda Live Debugger) proxy to actual AWS.

### Cited Findings
- Floci: Quarkus + GraalVM native Java reimplementation; Lambda/ECS/RDS use real Docker containers — [Floci site](https://floci.io/floci/); [LinkedIn/Floci summary](https://linkedin.com/company/floci)
- MiniStack: Python API emulator; Lambda runs real code (Python/Node in a warm worker pool per one blog, Go/Rust/C++ via Docker RIE); RDS, ElastiCache, ECS launch real containers; Athena uses DuckDB; Bedrock proxied to Ollama/vLLM — [MiniStack docs](https://www.ministack.org/docs/limitations); [themenonlab](https://themenonlab.blog/blog/ministack-free-localstack-alternative-42-aws-services-local)
- DynamoDB Local is the official AWS downloadable; database stored in files (shared-local-instance.db with -sharedDb) — [AWS docs](https://docs.aws.eu/amazondynamodb/latest/developerguide/DynamoDBLocal.UsageNotes.html)
- Dynalite (Lyft) is an older open-source reimplementation of DynamoDB — [GitHub](https://github.com/lyft/dynalite)

### Inferences
- No source found for Smithy/botocore-model-generated servers in the new entrants; LocalStack's use of botocore-derived specs is background knowledge only (see Gaps).

### Gaps
- Moto's internals (botocore-style response templates, server mode via Flask), LocalStack's ASF/Smithy-generated stubs, and the Lambda executor design were not confirmed by a source in this session.

## 3. Documented accuracy gaps

### Takeaway
Gaps cluster in (a) security (IAM not enforced by default), (b) "accepted but not dispatched" side-effects (streams, alarms, event routing), (c) event-source-mapping semantics, and (d) EventBridge pattern matching. Newer clones state these limits explicitly.

### Cited Findings
- LocalStack IAM enforcement is off by default; ENFORCE_IAM=1 enables evaluation of identity policies, resource policies, permission boundaries and SCPs; denials name the action and policy. Older forum answer said resource policies on SQS were not checked without Pro. Lambda Capacity Provider operator role is not enforced. Missing SNS-to-SQS permissions can fail silently — [IAM enforcement docs](https://docs.localstack.cloud/aws/capabilities/security-testing/iam-policy-enforcement); [forum](https://discuss.localstack.cloud/t/does-localstack-sqs-queue-check-policy-for-permissions/522); [IAM Policy Stream tutorial](https://docs.localstack.cloud/aws/tutorials/iam-policy-stream/)
- MiniStack (v1.4.21 limitations page): DynamoDB streams can be enabled but produce no records so Lambda triggers do not fire; global tables return success without replicating; CloudWatch alarms targeting Lambda are stored but never invoked; Lambda metrics not emitted; "stored but not dispatched" category — [MiniStack limitations](https://www.ministack.org/docs/limitations); [MiniStack DynamoDB](https://ministack.org/docs/services/dynamodb)
- DynamoDB Local vs service (AWS): throughput settings ignored; reads effectively strongly consistent due to speed; item collection metrics not tracked; index-query 1 MB limit counts entire item locally versus projected attributes in service; no table partitioning so stream shard behavior differs; no multi-Region/account — [AWS DynamoDB Local usage notes](https://docs.aws.eu/amazondynamodb/latest/developerguide/DynamoDBLocal.UsageNotes.html)
- Moto EventBridge issues (all closed unless noted): rule did not match null with "exists" filter (#5125, 2022); valid pattern failed to match (#4384, 2021); put_events with custom bus (#4395); S3 EventBridge notifications unimplemented (#7363, open); CloudTrail-delivered events unsupported (#8451, open) — [#5125](https://github.com/getmoto/moto/issues/5125); [#4384](https://github.com/getmoto/moto/issues/4384); [#7363](https://github.com/getmoto/moto/issues/7363); [#8451](https://github.com/getmoto/moto/issues/8451)
- LocalStack issues (titles only; all closed): SQS ESM invalid max batch size (#5042); ESM updates not respected for Kinesis/DynamoDB (#5982); Kinesis ESM onFailure with ReportBatchItemFailures (#11262); Kinesis ESM filters matched if any record in batch matched (#10716); duplicate ESMs allowed for SQS+Lambda (#9219); DynamoDB-to-Kinesis format differs (#4351); sendMessageBatch lacked AWS batch limit (#7106); API Gateway type=AWS differs (#12574) — [#5042](https://github.com/localstack/localstack/issues/5042); [#10716](https://github.com/localstack/localstack/issues/10716); [#9219](https://github.com/localstack/localstack/issues/9219); [#12574](https://github.com/localstack/localstack/issues/12574)
- Independent view: Floci's 1,925 passing tests show SDK-call compatibility, not behavioral equivalence with AWS — [codenote.net](https://codenote.net/en/posts/localstack-archived-oss-alternatives-comparison/) (via search summary)
- Step Functions Local lacks optimized integrations and distributed maps; TestState cannot run .sync — see section 1.

### Inferences
- Because issue-search sample was by keyword, counts of bugs are not rates; only the categories are informative.
- Closed issues indicate fixed cases; the same categories likely recur in fresh clones.

### Gaps
- Issue bodies and resolutions were not read; SQS visibility timeout, stream ordering and DynamoDB expression edge-case specifics not sourced. Full LocalStack search output saved at /root/.claude/projects/-home-user-agents/4aafdca6-ae8f-5b36-81e1-5c664f9ede2c/tool-results/mcp-github-search_issues-1792282017357.txt (unread beyond titles).

## 4. Startup time and latency

### Takeaway
Only vendor-published startup/memory figures were found, and they are for Floci versus LocalStack's community image; no independent per-request latency measurements.

### Cited Findings
- Floci claims about 24 ms startup, about 13 MiB idle memory, about 90 MB image vs LocalStack about 3.3 s, 143 MiB, 1.0 GB. One independent log showed native startup of 0.016 s for Floci 1.0.4. The 13 MiB is idle memory, not binary size — [Floci compare](https://floci.io/compare); [edelgado.is-a.dev](https://edelgado.is-a.dev/en/articles/floci-emulador-aws-local); [wavect](https://wavect.io/blog/floci-vs-localstack-aws-emulator/)
- ruststack claims 1.6 MB memory and sub-millisecond latency (self-reported in repo description, flagged "aislop" topic) — [GitHub](https://github.com/ehlerst/ruststack)
- SAM local: about 1 s per call on a cold container (anecdotal) — see section 1.

### Gaps
- No independent benchmark, no LocalStack Lambda cold-start numbers, no RIE or DynamoDB Local latency figures found.

## 5. Practitioner trust and "passed locally, broke in AWS"

### Takeaway
No specific incident write-up was found. The documented mechanism is that default-permissive local emulators (no IAM enforcement) let tests pass that fail in AWS.

### Cited Findings
- LocalStack's own docs recommend enabling IAM enforcement and generating policies, implying permission errors are the common production surprise — [IAM docs](https://docs.localstack.cloud/aws/capabilities/security-testing/iam-policy-enforcement)
- Community reaction to the licensing change was reported by InfoQ (concerns raised, Reddit thread cut off) — [InfoQ](https://www.infoq.com/news/2026/02/localstack-aws-community)
- A HN post on the LocalStack change exists (2026-01-06, 6 points shown; comments not read) — [Plushcap](https://www.plushcap.com/companies/localstack/hacker-news/2024/1) (index page; weak source)

### Gaps
- No HN/Reddit comment text or conference talks retrieved.

## 6. Parity measurement against real AWS

### Takeaway
LocalStack measures parity with "snapshot" tests: run against real AWS first, record responses, then compare LocalStack output with the recording; coverage pages flag operations as AWS Validated and Snapshot Tested. This proves tested paths only.

### Cited Findings
- Parity tests run first against AWS to collect snapshots, then compare LocalStack responses; tests use `snapshot.match` and transformers to normalise non-deterministic values; tests confirmed on AWS get an AWS-validated marker — [LocalStack parity testing docs](https://docs.localstack.cloud/contributing/parity-testing/); [Parity explained](https://blog.localstack.cloud/2022-08-04-parity-explained/)
- Coverage pages list per-operation flags for AWS Validated and Snapshot Tested — [coverage docs](https://docs.localstack.cloud/references/coverage/coverage_support)
- Floci's test suite is SDK-based rather than side-by-side against AWS — [wavect](https://wavect.io/blog/floci-vs-localstack-aws-emulator/)

### Inferences
- Of the 2026 clones, none was found publishing AWS-recorded parity suites; Moto's approach to AWS validation was not sourced.

### Gaps
- Percentage of LocalStack operations that are snapshot-tested not retrieved.
