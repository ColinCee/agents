// Preloaded by the install-home tests: answers each skill's fetch with FAKE_SKILL under that skill's name, or 404 when
// it is unset, so no test touches the network.
globalThis.fetch = async (url) => {
  if (!process.env.FAKE_SKILL) return new Response("missing", { status: 404 });
  const name = String(url).split("/").at(-2);
  return new Response(process.env.FAKE_SKILL.replace("reaching-homelab-devices", name));
};
