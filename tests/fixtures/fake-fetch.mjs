// Preloaded by the install-home tests: answers every fetch with FAKE_SKILL, or 404 when it is unset, so no test
// touches the network.
globalThis.fetch = async () =>
  process.env.FAKE_SKILL ? new Response(process.env.FAKE_SKILL) : new Response("missing", { status: 404 });
