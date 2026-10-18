# Cross-industry lessons for building a local AWS simulator incrementally

Method note: WebFetch failed with DNS errors on every host (cacm.acm.org, antithesis.com, blog.cloudflare.com, docs.tigerbeetle.com), so everything below comes from web-search result summaries, not full-page reads. Quotes are as the search tool returned them. Claims with no source are in Gaps or labelled Inferences. Several questions (semis silicon escape rates, trading certification, k8s kind, Stripe, Jepsen, share of sim vs real testing) were not sourced; I used about 17 tool calls.

## Semiconductors: RTL sim vs emulation vs silicon; golden models, UVM, validating the model

### Takeaway
Chip verification gets confidence by running the real design (RTL) against an independent, higher-level reference model through a scoreboard, with coverage measuring how much has been exercised. Reference models deliberately trade timing fidelity for speed. I found no sourced data on how the models themselves are validated or on silicon escape rates.

### Cited Findings
- A UVM scoreboard receives transactions from DUT interface monitors and compares predicted values from a reference model ("predictor") with actual values — [Verification Academy, A Generic UVM Scoreboard](https://verificationacademy.com/verification-horizons/november-2015-volume-11-issue-3/a-generic-uvm-scoreboard/) and [DVCon scoreboarding paper](https://dvcon-proceedings.org/wp-content/uploads/versatile-uvm-scoreboarding-us-paper.pdf)
- The same DVCon paper describes a scoreboard that can compare a DUT against several reference models at once (SystemVerilog, SystemC, Python) and even physical FPGA prototypes or ASICs; a transaction-level reference model does not capture exact RTL pipeline timing, so the scoreboard must tolerate transaction-order differences — [DVCon scoreboarding paper](https://dvcon-proceedings.org/wp-content/uploads/versatile-uvm-scoreboarding-us-paper.pdf)
- A scoreboard alone reports failures at transaction level, often many cycles after the error, with no view of internal state; a Broadcom/Avago poster proposes adding SVA assertions — [DVCon poster](https://dvcon-proceedings.org/wp-content/uploads/calling-all-checkers-collaboratively-utilizing-sva-in-uvm-based-simulation-poster.pdf)
- A RISC-V co-simulation framework pairs a UVM-TLM model with the Spike ISA simulator as golden reference, explicitly trading cycle-level precision for speed over RTL — [arXiv 2505.10145](https://arxiv.org/html/2505.10145v1)

### Inferences
- The pattern maps directly: the app's real Lambda code is the "DUT"; the simulator is the environment/reference; checks on observable outputs (messages emitted, items written) are the scoreboard. Timing/ordering looseness is accepted at the transaction level, which is the right stance for SQS/EventBridge ordering.
- Chip teams treat the reference model as a separate artifact checked against a different implementation (ISA simulator vs RTL). The AWS analogue is checking the simulator against real AWS (conformance suite), not just trusting it.

### Gaps
- No source found on RTL sim vs FPGA emulation vs silicon cost/speed ratios or the share of bugs found at each stage.
- No source on how golden models are themselves validated (e.g. architectural compliance suites), or on post-silicon escape rates.
- Coverage-driven verification closure not sourced.

## Automotive/aerospace: SIL/HIL/digital twins; tool qualification

### Takeaway
Safety standards do not ask whether a simulator is "perfect"; they ask what happens if it is wrong. Tool impact (could it hide an error?) and error detection (would you notice?) determine how much qualification is needed. Practically: a simulator whose output is independently cross-checked needs less trust.

### Cited Findings
- ISO 26262 tool confidence: Tool Impact (TI1 = no possibility of introducing/hiding errors, TI2 otherwise) and Tool error Detection (TD1 = high confidence errors prevented/detected, TD3 otherwise) give a Tool Confidence Level; TCL1 needs no qualification, TCL2/TCL3 require it — [Validas glossary](https://www.validas.de/resources/glossary/tool-confidence-level); [Synopsys white paper](https://www.synopsys.com/content/dam/synopsys/solutions/documents/automotive-tool-confidence-iso-26262-wp.pdf) (listed in results; details taken from the search summary)
- Cadence reported a TÜV SÜD "Fit for Purpose – TCL1" certification for design flows, usable for ASIL A–D projects — [ElectronicSpecifier](https://www.electronicspecifier.com/products/design-automation/design-flows-receive-fit-for-purpose-tcl1-certification/)
- DO-330 (tool qualification supplement to DO-178C): Criterion 1 = tool could insert an error into airborne software; Criterion 2 = verification tool that could miss an error and is used to reduce other verification/development activities; Criterion 3 = verification tool that could miss an error but is not used to reduce other activities. Required Tool Qualification Level depends on criterion and software level, ranging from TQL-5 to TQL-1 — [Afuzion](https://afuzion.com/?p=358); [Visure](https://visuresolutions.com/do-178-guide/do-330)
- Not every feature of a verification tool is qualified; users must check which features are in the qualification kit — [Military Embedded Systems](https://militaryembedded.com/avionics/safety-certification/trusting-tools-agile-approach-tool-qualification-do-178c)

### Inferences
- A local AWS simulator is a Criterion 3 / TI-low style tool as long as it is only one of the gates (a real deploy/smoke test still happens). It becomes load-bearing (Criterion 2 analogue) only if the team uses it to skip real-AWS testing; the more it replaces, the more evidence of its fidelity is needed.
- "Qualify the feature, not the tool": claim fidelity per service operation actually used (e.g. SQS SendMessage/redrive), with a conformance test per claim.

### Gaps
- No sourced figure for share of testing done in SIL/HIL vs real vehicles/flight.
- No source on digital twins or SIL/HIL definitions; ISO 26262 Part 8 and DO-330 text not read directly. The exact criterion/DAL-to-TQL table was not retrieved.

## Trading/finance: exchange simulators and replay

### Takeaway
Firms test against exchange behaviour they do not control with vendor or in-house simulators that speak the exchange's native protocol, plus replay of captured market data. The sources are vendor marketing; no sourced account of how fidelity is validated.

### Cited Findings
- Two simulator categories: API emulators (mimic connectivity, scripted responses) vs market simulators (model market behaviour or replay history) — [Exactpro deck](https://speakerdeck.com/exactpro/algo-testing-advantages-vs-shortcomings)
- Esprow markets exchange simulators with matching engine, order books and gateways modelled on real exchanges (FIX and native binary), for regression testing and CI/CD — [Esprow](https://esprow.com/products/onboarding-and-certification/binary-exchange-simulation.php) (vendor claim)
- Exegy's journal replay drives trading systems with captured market-data event streams including past conditions and high-rate stress — [Exegy](https://exegy.com/exegy-launches-market-data-capture-replay-service) (vendor claim)
- FIX certification suites exist to certify a client's order flow before connecting — [FIX Trading Community](https://forum.fixtrading.org/t/fix-testing-and-certification/10029)

### Inferences
- The finance split (scripted protocol emulator vs behavioural model) mirrors AWS: an API-contract emulator (accepts/returns the right shapes) is cheap; a behavioural model (retries, visibility timeouts, ordering, throttling) is where the cost is.
- Exchanges provide their own test environments and certification, which is the closest analogue to "the real thing gives you a conformance oracle"; AWS has no such certification, so you have to build the oracle by recording real AWS responses.

### Gaps
- No source on how exchanges' official test venues differ from production, or how firms validate their own simulators. Search returned only vendor pages.

## Distributed databases: FoundationDB, TigerBeetle, Antithesis, Jepsen, AWS formal methods

### Takeaway
Deterministic simulation works because the team owns the code and can replace network, disk and clock with seeded models, then inject faults at compression rates; it is the strongest result in this survey, but it checks logic against modelled environments and is not a substitute for real-cluster testing. AWS combines TLA+/P with simulation and checks implementation logs against the spec (PObserve).

### Cited Findings
- FoundationDB built a deterministic simulation framework that simulates a network of interacting processes and many disk, process, network and request-level failures within a single physical process; a C++ syntactic extension (Flow) was created for it — [CACM FoundationDB article](https://cacmb4.acm.org/magazines/2023/6/273229-foundationdb-a-distributed-key-value-store); SIGMOD 2021 paper DOI 10.1145/3448016.3457559 (Zhou et al.), not read in full
- TigerBeetle's VOPR runs production code with clock, network and disk stubbed, injects dropped/reordered packets, partitions and corrupted I/O; failures replay from seed plus git commit; docs say one minute of VOPR time is equivalent to days of real-world testing — [TigerBeetle docs](https://docs.tigerbeetle.com/about/vopr)
- Antithesis (founded by FoundationDB alumni) sells deterministic simulation for arbitrary software; reproducibility from a seed is the selling point; reported customers include MongoDB, Palantir and Ethereum's Merge — [Rootly profile](https://rootly.com/humans-of-reliability/will-wilson-antithesis); [The Bridge](https://thebridge.jp/2025/12/antithesis-105m-series-a-jane-street-deterministic-simulation-testing) (secondary)
- Claim that the FDB simulator found essentially all bugs before release is vendor-side and unverified by the source itself — [Antithesis DST page](https://antithesis.com/docs/resources/deterministic_simulation_testing/) (as relayed by the search tool)
- A third-party post argues simulation finds logic bugs, not environment bugs, because the simulated network and disk are models; coverage is probabilistic — [Mohak Chugh blog](https://mohakchugh.is-a.dev/blog/deterministic-simulation-testing) (secondary, opinion)
- AWS: CACM June 2025 "Systems Correctness Practices at Amazon Web Services" (Brooker, Desai) covers TLA+, P, property-based testing, fault-injection testing and event-based simulation; in the past testing was mainly build-time unit tests, often against mocks, plus limited integration tests; PObserve (2023) checks structured logs from running systems against P specs in test and production — [CACM](https://cacm.acm.org/practice/systems-correctness-practices-at-amazon-web-services); [ACM Queue](https://queue.acm.org/detail.cfm?id=3712057)
- AWS's FMCAD 2025 tutorial lists deterministic and event-based simulation and runtime trace validation, with formal specs often serving as test oracles — [FMCAD25](https://fmcad.forsyte.at/FMCAD25/invited_speakers)

### Inferences
- These results apply to systems where the builder controls the code under test. The AWS-simulator case is inverted: the "environment" (AWS) is the thing being modelled and is not owned, so deterministic simulation gives repeatability and fault injection for the app's own logic, not proof that AWS behaves like the model.
- The PObserve idea (check real traces against the spec) is the portable one: record real AWS interactions and use them to keep the simulator honest.
- Useful byproduct: a simulator with a seeded clock and fault injection (duplicate delivery, redelivery, Lambda timeout) tests the event-driven failure modes that mocks never exercise.

### Gaps
- Jepsen not covered. Specific bug counts for FDB/TigerBeetle not verified against primary sources. "What simulation missed" examples (real incidents that escaped simulation) not found. The SIGMOD paper and CACM article bodies were not read; S3/DynamoDB P-language case studies not retrieved.

## Telecom/payments: conformance suites, network emulators

### Takeaway
Not researched beyond one related find; no sourced content.

### Cited Findings
- FIX protocol testing/certification exists as a conformance mechanism in finance — [FIX Trading Community](https://forum.fixtrading.org/t/fix-testing-and-certification/10029)

### Inferences
- Conformance suites are defined against a published spec. AWS service behaviour is documented but not formally specified, so the equivalent suite must be built from recorded real behaviour.

### Gaps
- 3GPP conformance and EMV certification harnesses not searched (ran out of budget).

## Other software ecosystems: Miniflare/workerd, Firebase emulators, kind/k3d, Stripe test mode, Temporal

### Takeaway
Emulators succeed when they run the real runtime and honestly list what they do not model. Cloudflare moved from a Node reimplementation to the production runtime to fix mismatches. Firebase and DynamoDB Local publish explicit gap lists (no IAM, no composite-index tracking, no throttling). Temporal's time-skipping test server shows a high-value, narrow emulator (time).

### Cited Findings
- Miniflare is described as a simulator running Workers on the same workerd runtime used in production; bindings are simulated locally by default, remote bindings can reach real resources while code runs locally; unsupported bindings need `--remote`; local workerd runs with TZ=UTC to match production — [Cloudflare docs](https://developers.cloudflare.com/workers/local-development/)
- Wrangler v3 moved to Miniflare v3 on workerd because the earlier Node reimplementation caused behaviour mismatches — [Cloudflare blog, Wrangler v3](https://blog.cloudflare.com/wrangler3) (as summarized by search; not read in full)
- Firebase Emulator Suite does not model IAM; supports a limited set of function trigger types (HTTP, Eventarc custom, and background triggers for Firestore, Realtime DB, Storage, Auth, Pub/Sub); production task dispatch is more complex than the emulator's; emulator does not track composite indexes and runs any valid query; does not mimic production limits (timeouts, sizes); Firebase recommends testing against a real Firestore instance for these — [Firebase connect functions](https://firebase.google.com/docs/emulator-suite/connect_functions); [Firebase extensions emulator](https://firebase.google.cn/docs/emulator-suite/use_extensions); [Firestore emulator](https://docs.cloud.google.com/firestore/docs/emulator)
- DynamoDB Local (AWS's own emulator) does not enforce provisioned throughput or throttle, reads look strongly consistent, no item collection metrics, different 1 MB size calculation for index queries, streams shards differ, and TransactionConflictException is not thrown — [AWS DynamoDB Local usage notes](https://docs.aws.amazon.com/ru_ru/amazondynamodb/latest/developerguide/DynamoDBLocal.UsageNotes.html)
- The dynalite author (2016) reported many early mismatches with real DynamoDB (nested UpdateItem attributes, size limits); partially fixed later — [dynalite](https://github.com/lyft/dynalite) (dated)
- One blog says LocalStack's DynamoDB is powered by DynamoDB Local, so it would inherit its gaps; not confirmed from LocalStack docs — [dev.to](https://dev.to/dynotable/how-to-connect-to-dynamodb-local-and-localstack-12d1)
- Temporal's test server runs in-memory and skips time so a day-long sleep finishes in seconds; timers are fast-forwarded except while Activities run; time is global to an environment instance, so tests wanting different time behaviour need separate instances — [Temporal TypeScript testing](https://docs.temporal.io/develop/typescript/testing-suite); [Python](https://docs.temporal.io/develop/python/testing-suite)

### Inferences
- Even the vendor's own emulator (DynamoDB Local) omits throttling and transaction conflicts: exactly the failure modes an event-driven system most needs. Expect that "happy-path contract" is achievable and "behaviour under pressure" is the long tail.
- Time control (Temporal) is a cheap, high-leverage feature for SQS visibility timeouts, EventBridge Scheduler, Lambda timeouts, TTL.
- Cloudflare's lesson: where the real runtime is available locally, run it. For AWS: Lambda runtime interface/ RIE images and DynamoDB Local are real vendor artifacts; EventBridge, SQS, SNS control planes are not.

### Gaps
- Kubernetes kind/k3d and Stripe test mode not searched. LocalStack's own documented parity/coverage not retrieved. Failures due to simulator drift beyond Firebase/DynamoDB Local gap lists were not found.

## Cross-cutting: "fidelity where it matters" and drift

### Takeaway
Successful simulators model the contract the system under test depends on, state their gaps, and either run the real implementation (workerd, DynamoDB Local) or are continuously checked against it. Weak ones are reimplementations without an oracle.

### Cited Findings
- Cloudflare abandoned a Node reimplementation for the production runtime to remove mismatches — [Cloudflare blog](https://blog.cloudflare.com/wrangler3)
- Firebase tells users to test index requirements and production limits against a real instance — [Firestore emulator](https://docs.cloud.google.com/firestore/docs/emulator)
- AWS's runtime trace checking against specs (PObserve) is an explicit "keep model and implementation aligned" mechanism — [CACM](https://cacm.acm.org/practice/systems-correctness-practices-at-amazon-web-services)
- Tool-qualification regimes credit independent error detection (TD) as much as tool quality — [Validas](https://www.validas.de/resources/glossary/tool-confidence-level)

### Inferences
- Drift is the main long-term risk; it is mitigated by (a) a conformance suite run against both simulator and real AWS on a schedule, (b) a published "not modelled" list, (c) failing loudly on unsupported APIs instead of silently accepting them (Firebase demo-project behaviour: calls to non-running emulators fail).

### Gaps
- No quantitative drift data found.

## Synthesis (my inference throughout)

### Takeaway
A first slice is feasible if it is defined as "run the real Lambda code, route events between a handful of services according to the deployed IaC, with injectable faults and a controllable clock", and explicitly not "emulate AWS". It stops being feasible if scope creeps toward full service semantics, IAM, or performance.

### Cited Findings
- (Supporting facts are cited in the sections above; nothing in this section is separately sourced.)

### Inferences
- Smallest useful slice (inference): (1) read the app's IaC (CDK/CloudFormation/Terraform) to build a graph of functions, queues, topics, rules, tables and their triggers; (2) run the actual function code in the AWS-provided Lambda runtime images (Cloudflare lesson: run the real runtime); (3) implement SQS, SNS, EventBridge rule matching/targets and DynamoDB (wrapping DynamoDB Local) as contract-level services with at-least-once delivery, duplicate/redelivery and DLQ semantics; (4) a virtual clock (Temporal lesson) and seeded fault injection (FDB/TigerBeetle lesson); (5) fail loudly on any unmodelled API or resource property.
- Build order (inference): Lambda invoke + event shape fixtures; SQS to Lambda event-source mapping; EventBridge pattern matching (pure function, testable offline); DynamoDB via existing local engine; then SNS/Step Functions only if the app needs them.
- Make confidence measurable (chip/PObserve lesson): a conformance suite of recorded real-AWS request/response pairs, replayed against the simulator in CI, and re-recorded periodically to catch drift. Per-feature claims ("we model X to level Y") instead of a blanket "AWS-compatible".
- Honest "needs real AWS" remainder (inference): IAM/resource policy and KMS authorisation; VPC/networking and cold-start/latency/concurrency/throttling behaviour; service quotas and payload limits at scale; DynamoDB partition/throttling and transaction conflict behaviour (DynamoDB Local itself omits these); eventual-consistency timing; exact retry/backoff timing of managed services; IaC deployment errors (permissions, quota, resource-name conflicts); third-party integrations; anything the app calls that is not in the modelled set. A thin real-AWS smoke test in a shared dev account stays necessary for these.
- Feasibility threshold (inference): treat as infeasible if the plan requires emulating service internals (consistency model, scheduler, IAM evaluation). Treat as feasible if every simulated behaviour traces to a documented contract the app uses and every claim has a conformance test.

### Gaps
- No evidence gathered on existing AWS-local tools' (LocalStack, SAM, Moto) actual drift rates or on app-level bug classes that escape them; I did not research the AWS tooling landscape, which other researchers may cover.
