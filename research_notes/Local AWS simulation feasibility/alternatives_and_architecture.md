# Alternatives to a full local AWS emulator, and architecture of a better simulator

Note on method: ~18 tool calls, mostly WebSearch (WebFetch failed with DNS errors, so primary pages were not read in full; claims are from search-result summaries). Many sources are vendor/marketing or third-party blogs; flagged where so. Iteration-time numbers are mostly secondary.

## 1. Hybrid approaches (local code, real cloud) and their iteration times

### Takeaway
Hybrid tools fall in two classes: "live proxy" (SST Live, Serverless dev mode, Lambda remote debug) where code edits take effect locally in well under a second after a one-off multi-minute deploy; and "fast deploy" (CDK hotswap, `sam sync`) at roughly 3-10 s per code change vs 1-2+ min full deploys. All run against real AWS, so behaviour is trustworthy but you need credentials, network, and a deployed stack.

### Cited Findings
- SST docs claim Live reloads local changes in under 10 ms with no redeploy; first start takes a couple of minutes (a forum user reported just over 4 min for first `sst start`). No independent benchmarks found; the 10 ms is SST's own figure and likely excludes network round-trip. — [SST live docs](https://sst.dev/docs/live) via search summary; [strategies for faster lambda development](https://dev.to/jolodev/strategies-for-a-faster-lambda-development-2eb2); [SST forum](https://discourse.sst.dev/t/a-way-to-quickly-redeploy-lambda-scripts-with-live-dev-disabled/2758)
- SST v3 mechanism: `sst dev` deploys the app, replaces Lambdas with stubs, and uses AWS AppSync Events to relay invocations to the local machine, which runs them as a Node.js worker. If the CLI is killed, stubs remain and time out until `sst deploy`. A user reported a regression in 3.3.x when the bridge moved to AppSync (user report, unverified). — [SST live docs](https://sst.dev/docs/live); [SST forum](https://discourse.sst.dev/t/sst-v3-body-sst-dev-is-not-running/2992)
- Serverless Framework v4 `serverless dev`: live Lambda functions redirect events to local code and the local response is returned; intended for dev environments, redeploy afterwards to restore code. A forum report says the proxy accepts invocations even when `serverless dev` is not running (silent success, incomplete data). — [Serverless v4 GA](https://serverless.com/blog/serverless-framework-v4-general-availability); [docs](https://www.serverless.com/framework/docs/providers/aws/guide/agents/dev); [forum](https://forum.serverless.com/t/serverless-v4-local-dev-serverless-dev-behavior-when-not-running/20382)
- AWS Lambda remote debugging from VS Code (AWS Toolkit, announced July 2025): Toolkit adds a debug layer (~40 MB, counts to 250 MB limit), raises invoke timeout to 900 s, uses AWS IoT Secure Tunneling to link local debugger to the Lambda runtime; supports Python, Java, Node.js/TS on AL2023; not OCI image or Lambda managed instances; reverts on "Remove Debug Setup". It debugs one function in the cloud; it is not an edit-run loop for a whole system. — [Lambda docs](https://docs.aws.amazon.com/lambda/latest/dg/debugging.html); [Toolkit docs](https://docs.aws.amazon.com/toolkit-for-vscode/latest/userguide/lambda-remote-debug.html); [What's New](https://aws.amazon.com/about-aws/whats-new/2025/07/aws-lambda-debug-functions-cloud-vs-code-ide)
- CDK hotswap: bypasses CloudFormation for supported changes (Lambda code etc.); CDK workshop example 3 s hotswap vs 67 s full deploy (another summary of same workshop says ~9.5 s total); "order of magnitude" speedup typical for Lambda; creates drift, dev-only. — [CDK workshop cdk watch](https://cdkworkshop.com/20-typescript/30-hello-cdk/300-cdk-watch.html); [endoflineblog](https://www.endoflineblog.com/cdk-tips-06-speeding-up-cdk-application-development) (the 3 s and 9.5 s figures conflict in how the search summary reported them; both come from the same workshop page)
- SAM Accelerate (`sam sync`, SAM CLI >=1.53): code changes skip CloudFormation; third-party estimate 5-10 s vs 70-150 s full build+deploy (estimate, not benchmark). — [oneuptime guide](https://oneuptime.com/blog/post/2026-02-12-sam-accelerate-faster-development-cycles/view)
- CloudFormation Express Mode: AWS claims up to ~4x faster deployments by completing once config is applied rather than after stabilization; keeps CloudFormation state consistent (unlike hotswap). Source is a mirror of AWS docs; verify on official page. — [Express mode docs (mirror)](https://docs.amazonaws.cn/en_us/AWSCloudFormation/latest/UserGuide/cloudformation-express-mode.md)
- Architect Sandbox and "personal dev stacks" cost: no sources found (see Gaps). Yan Cui argues per-developer/feature-branch stacks cost overhead is negligible for serverless because of pay-per-use. — [theburningmonk](https://theburningmonk.com/2019/09/why-you-should-use-temporary-stacks-when-you-do-serverless/)

### Inferences
- Live-proxy tools give sub-second edit loop but only for Lambda code; changes to wiring (IAM, event source config, schemas) still need a 5 s to minutes deploy. That wiring is exactly where serverless bugs live, so hybrid does not replace pre-deploy static checks.
- Cost is dominated by developer-time and API/AppSync/IoT usage, which is small; main cost is a per-developer AWS account/stack and credential management.
- Live proxy adds network latency per invocation and a local-to-cloud trust path (stubs, AppSync, IoT tunnel), and does not reproduce Lambda's real sandbox (memory, cold start, VPC).

### Gaps
- No measured end-to-end latency numbers for SST Live, Serverless dev, or Lambda remote debug (round-trip overhead). Cost figures for these not found. Architect sandbox not researched (budget).

## 2. Ephemeral environments and realistic minimum deploy time

### Takeaway
AWS-recommended and practitioner-recommended pattern is a per-developer/per-PR stack; no rigorous like-for-like benchmark of CloudFormation vs Terraform vs Pulumi exists in what I found. Secondary sources say 10-20 resources take ~3-5 min on CloudFormation vs 1-3 min on Terraform; hotswap/`sam sync`/Express Mode cut Lambda iteration to seconds.

### Cited Findings
- Claimed deployment speed for 10-20 resources: CloudFormation ~3-5 min, Terraform ~1-3 min; Pulumi 1-7 min, no methodology. Treat as unverified. — [towardsthecloud comparison](https://towardsthecloud.com/blog/aws-cdk-vs-terraform); [index.dev](https://www.index.dev/skill-vs-skill/devops-pulumi-vs-terraform-vs-cdk)
- CloudFormation slowness is attributed to resource lifecycle (replacement, rollback, stabilization waits). — [endoflineblog](https://www.endoflineblog.com/cdk-tips-06-speeding-up-cdk-application-development)
- Per-PR environment tutorials use Terraform workspace per PR number or a stack per branch (`sls deploy -s dev-my-feature`, `sls remove`); none give timings. — [oneuptime terraform ephemeral](https://oneuptime.com/blog/post/2026-02-23-terraform-cicd-ephemeral-environments/view); [theburningmonk](https://theburningmonk.com/2019/09/why-you-should-use-temporary-stacks-when-you-do-serverless/)
- Yan Cui: for stateful serverful deps (e.g. RDS) share one instance and create a database per environment. — [theburningmonk](https://theburningmonk.com/2019/09/why-you-should-use-temporary-stacks-when-you-do-serverless/)
- An AWS sample (ephemeral-preview-containers-furl) claims per-PR environments in seconds using Lambda Function URLs (vendor-style claim, not benchmark). — [aws-samples repo listing](https://fr.github.com/aws-samples/ephemeral-preview-containers-furl)

### Inferences
- Realistic floor for a first deploy of a small Lambda+API+DynamoDB+SQS stack is on the order of 1-3 min; slow resources (CloudFront, RDS, VPC endpoints/ENIs, custom resources) push to 10+ min. This is my estimate from the secondary ranges, not measured.
- Stack pooling / pre-warmed accounts were not found documented; inferred benefit: pay the multi-minute create once, then update with hotswap-class tools in seconds.

### Gaps
- No primary benchmark of CFN vs Terraform vs Pulumi vs Cloud Control API deploy time; no documentation of stack pooling or pre-warmed account pools; no CI cost numbers.

## 3. Testing strategies and keeping a simulator honest

### Takeaway
AWS's own guidance is "test in the cloud as much as possible", with mocks for fast unit tests only. The most reusable honesty mechanism found is LocalStack's snapshot/parity approach: run a test against real AWS, record responses, replay the same test against the emulator and diff.

### Cited Findings
- AWS Prescriptive Guidance: "focus on testing in the cloud as much as possible"; mocks fine for fast unit tests but code covered by mocks should also be tested in the cloud because local config may differ. — [AWS Prescriptive Guidance best practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/serverless-application-testing/best-practices.html) (via search summary)
- aws-samples/serverless-test-samples: organized by language and workload (APIs, event-driven, orchestration, data processing); includes integration tests that run locally against deployed resources reading stack outputs. — [serverless-test-samples fork listing](https://github.com/aleios-cloud/serverless-test-samples); [AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/serverless-application-testing/introduction.html)
- AWS Integrated Application Test Kit (IATK) includes polling-based async tests and X-Ray trace assertions. — [AWS Compute Blog](https://aws.amazon.com/blogs/compute/aws-integrated-application-test-kit)
- LocalStack parity testing: tests run first against real AWS (`TEST_TARGET=AWS_CLOUD`, `SNAPSHOT_UPDATE=1`), responses captured via `snapshot.match`, normalized with transformers, stored as `*.snapshot.json`; tests marked `@markers.aws.validated`; snapshot tests are preferred; snapshot files must not be hand-edited. — [LocalStack parity testing](https://docs.localstack.cloud/contributing/parity-testing/); [integration tests](https://docs.localstack.cloud/contributing/integration-tests/); [AGENTS.md mirror](https://fossies.org/linux/localstack/AGENTS.md)
- Yan Cui (via InfoQ): LocalStack gives fast feedback but is never a perfect representation of the cloud. — [InfoQ](https://www.infoq.com/news/2024/04/aws-serverless-best-practices/)
- Pact supports message (async) contracts: consumer states payload, Pact stores contract, producer verifies; limitation: only protects what consumers test. Pact Broker `can-i-deploy` gates. Schema-registry compatibility modes (Avro) are the alternative. — [codecentric](https://blog.codecentric.de/message-pact-contract-testing-in-event-driven-applications); [theburningmonk on event schema breaking changes](https://theburningmonk.com/2025/04/how-to-detect-and-prevent-breaking-changes-in-event-schemas/)
- Event Ruler (Apache 2.0, Java) is the library behind EventBridge matching since Feb 2024 (v1.5.0), matching "several hundred thousand events per second" independent of number of rules; ports exist: py-event-ruler, eb-patterns (npm, local testEventPattern), Quamina (Go, Tim Bray). — [AWS blog](https://aws.amazon.com/blogs/opensource/open-sourcing-event-ruler); [What's New](https://aws.amazon.com/about-aws/whats-new/2024/02/amazon-eventbridge-event-bus-matching-event-ruler); [GitHub](https://github.com/aws/event-ruler); [Tim Bray](https://www.tbray.org/ongoing/When/202x/2022/09/02/Hello-Ruler)

### Inferences
- Because EventBridge's real matcher is open source, a simulator can embed the true engine for that service (rare case of bit-for-bit fidelity).
- A simulator's honesty can be defined as: every behavior it claims has a recorded real-AWS snapshot with a date and region.

### Gaps
- No EventBridge-specific Pact guidance found; EventBridge schema registry/AsyncAPI not researched; hexagonal-architecture-for-Lambda sources and test-in-production not researched (budget); no VCR/botocore-stubber source.

## 4. Static / pre-deploy verification

### Takeaway
IAM Access Analyzer custom policy checks give a real automated-reasoning check of policy diffs; I found no source confirming that cfn-lint/cdk-nag/checkov detect event-source wiring bugs (e.g. Lambda not permitted to be invoked), so that "infrastructure graph analysis" idea appears to be a gap in existing tooling (unverified absence).

### Cited Findings
- `CheckNoNewAccess` compares a new policy to a reference policy; PASS means no new access, FAIL means may allow new access, errs towards FAIL (false positives possible); supports IDENTITY_POLICY and RESOURCE_POLICY; charged per check. — [boto3 docs](https://boto3.readthedocs.io/reference/services/accessanalyzer/client/check_no_new_access.html); [IAM docs](https://docs.aws.amazon.com/es_es/IAM/latest/UserGuide/access-analyzer-custom-policy-checks.html)
- Amazon Science: custom policy checks "democratize automated reasoning". — [Amazon Science](https://www.amazon.science/blog/custom-policy-checks-help-democratize-automated-reasoning)
- AWS sample validates IAM policies in CloudFormation templates with Access Analyzer. — [aws-samples](https://github.com/aws-samples/access-analyzer-automated-policy-analysis-blog)
- Runtime facts a graph checker would encode: event source mappings need an execution role to read the event source; service-to-Lambda invocation (e.g. S3) is governed by a resource-based policy on the function. — search results from [Elastic docs](https://www.elastic.co/guide/en/security/current/aws-lambda-event-source-mapping-creation.html) and a Lambda roles page; secondary.

### Inferences
- A graph analyzer over the synthesized CloudFormation (edges: source -> trigger -> function -> role -> resource) could report missing Lambda::Permission, missing role actions, dead-letter/filter mismatches before deploy; I did not find an existing product doing the full check.
- Such a checker doubles as the wiring layer a simulator needs, so the two efforts share a parser.

### Gaps
- Did not verify what cfn-lint, cdk-nag, checkov rules exist for event wiring; search returned nothing relevant.

## 5. Building a new simulator

### Takeaway
The landscape shifted in 2026: LocalStack's open-source Community Edition ended (repo archived, auth token required from 23 March 2026), spawning many new emulators (Floci/Java, MiniStack/Python, fakecloud/Rust, ruststack/Rust, LocalEmu fork). The one that uses Smithy-model-generated conformance tests is fakecloud, but claims are self-reported. Nobody found does differential testing against real AWS at scale other than LocalStack's snapshot approach.

### Cited Findings
- LocalStack: announced Dec 2025; since 23 March 2026 all users, incl. free Hobby tier, need an account and token; open-source repo archived; community image gets no security patches; Hobby free for non-commercial; paid tiers from ~$39/mo. Secondary reporting; check LocalStack announcement. — [InfoQ](https://www.infoq.com/news/2026/02/localstack-aws-community); [Chainguard notice](https://support.chainguard.dev/hc/en-us/articles/49369574832667-LocalStack-Image-Decommission-Notice); [agentdeals](https://agentdeals.dev/localstack-alternatives)
- Alternatives: fakecloud (Rust, ~19 MB static binary, AGPL-3.0, claims 20 to 105 services depending on page); ruststack (Rust, S3 70 ops from Smithy model and DynamoDB 12 ops, MIT); Floci (Java/Quarkus, MIT); MiniStack (Python, claims 60+ services); LocalEmu (Python fork of old LocalStack Apache code). Performance claims are self-reported. — [lib.rs fakecloud](https://lib.rs/crates/fakecloud); [ruststack](https://github.com/tyrchen/ruststack); [floci](https://github.com/floci-io/floci); [MiniStack](https://ministack.org/); [LocalEmu](https://localemu.cloud/docs/story/); [comparison (fakecloud's own blog)](https://fakecloud.dev/blog/localstack-alternatives-compared/)
- fakecloud claims Smithy-model-generated test variants pass on every commit (reported as 248,557 variants over 3,932 implemented operations; other listings give 124,255 or 59,000+, so number is unstable), plus upstream Terraform provider tests in CI. A commenter disputed the "100%" claim for DynamoDB. No evidence found of differential tests against real AWS. — [zeli.app summary](https://zeli.app/story/49856885); [oflight](https://www.oflight.co.jp/en/columns/fakecloud-free-aws-emulator-localstack-alternative-2026); [lobste.rs](https://lobste.rs/s/gjclmd/fakecloud_free_open_source_aws_emulator)
- Smithy conformance tests check protocol shape (serialization), not semantic behaviour (throttling, ordering, eventual consistency, IAM). (My reading of what such tests can cover; the fakecloud claim itself is limited to the shape tests.)
- Reusable official artifacts: Event Ruler (above). DynamoDB Local, Lambda RIE, and Cedar-like IAM evaluation: not researched in this pass.
- Deterministic simulation testing (DST): single seeded RNG as only nondeterminism, replay by seed; pioneered by FoundationDB; TigerBeetle VOPR (seed + git commit reproduces; time compression, "one minute of VOPR time is equivalent to days"). DST in FoundationDB-style needs every nondeterministic component pluggable (impractical for existing systems); alternative is a deterministic hypervisor (Antithesis). — [TigerBeetle VOPR](https://docs.tigerbeetle.com/about/vopr); [Antithesis](https://antithesis.com/resources/deterministic_simulation_testing/)
- No source found applying DST to AWS service emulation.

### Inferences (design proposal, not sourced)
- Architecture: (1) generate API surface, validation and error shapes from Smithy/botocore models; (2) hand-write semantics per service as small deterministic state machines driven by a virtual clock and seeded scheduler, which also makes fault injection (duplicate SQS/EventBridge delivery, reorder, throttle, partial batch failure, at-least-once retries) a first-class, replayable feature real AWS cannot give; (3) embed real artifacts where available (Event Ruler for EventBridge); (4) read the app's synthesized CloudFormation to instantiate and wire resources, sharing the parser with a static wiring checker; (5) keep honest via a conformance corpus recorded from real accounts in LocalStack-snapshot style, with each behavior tagged as validated/unvalidated and dated; (6) be explicit about out-of-scope behaviors (IAM enforcement depth, cold starts, limits).
- Speed: a single static binary (Rust/Go) with in-memory state starts in milliseconds; the Lambda execution itself (RIE/containers) will dominate startup, so run handlers in-process or as warm workers.
- Conformance record cost and per-region/account variance are the main risk; corpus of snapshots is the moat, not the code.

### Gaps
- Not verified: any project doing recorded-real-AWS differential testing besides LocalStack; Moto/Localstack internals; DynamoDB Local / Lambda RIE licensing and fidelity; Cedar/IAM evaluation reuse.

## 6. Other clouds, and why Cloudflare can run production locally

### Takeaway
Cloudflare's Miniflare 3 runs workerd, the same open-source runtime as production, so only bindings (KV, R2, D1) are simulated; AWS Lambda's production substrate (Firecracker microVMs, closed control plane, dozens of closed services) is not open, so an emulator must reimplement behavior.

### Cited Findings
- Miniflare 2 reimplemented Workers APIs in JavaScript causing mismatches; Miniflare 3 switched to workerd so code runs on the production runtime; bindings simulated locally by default, with remote bindings available to hit real resources. — [Cloudflare blog](https://blog.cloudflare.com/miniflare-and-workerd); [Cloudflare local dev docs](https://developers.cloudflare.com/workers/local-development/)
- Firestore emulator: simpler transaction handling (basic locking, locks up to 30 s), does not mimic production limits, in-memory only. Firebase advises not to expect emulated behavior to fully mirror production. — [Firestore emulator docs](https://docs.cloud.google.com/firestore/docs/emulator)
- Azure: only a competitor page (Floci) claims Azurite lacks Cosmos DB, Key Vault, Event Hubs and Service Bus; Azurite older note on Table storage is from 2020; treat as unverified. — [floci-az](https://railway.com/deploy/floci-az.md)

### Inferences
- Cloudflare's advantage: the runtime and most bindings are one vendor's small, owned surface; the runtime was deliberately open-sourced (workerd) for this. AWS's equivalent partial pieces: Lambda RIE, Event Ruler, DynamoDB Local. (The Firecracker/closed-control-plane explanation is my background knowledge, not a cited finding.)
- Even Cloudflare needs remote bindings for non-simulated resources, i.e. hybrid mode is the pragmatic complement.

### Gaps
- Azure Functions Core Tools, GCP Pub/Sub emulator fidelity, and Cloudflare's own statements on why AWS cannot match this not found in primary sources.
