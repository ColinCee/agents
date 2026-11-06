import { expect, test } from "claude-code/testing";
import { bandOf } from "../hooks/band";

const NOW = Date.parse("2026-10-15T12:00:00Z");
const state = (holds: object[], waiting: object[] = []) =>
  JSON.stringify({
    version: 2,
    holds,
    waiting,
    cooldowns: [],
    resources: [{ name: "browser", label: "WEB", used: "2026-10-15T11:00:00Z" }],
    free_gb: 1.4,
    measured: "2026-10-15T11:59:50Z",
  });
const strata = {
  name: "cortex",
  pid: 100,
  taken: "2026-10-15T11:48:00Z",
  renewed: "2026-10-15T11:59:50Z",
  expires: "2026-10-15T12:01:50Z",
  until: null,
  wants: [
    { resource: "gpu", gb: null },
    { resource: "ram", gb: 40 },
  ],
  note: "Strata",
  job: { pid: 900, started: "x" },
  orphaned: null,
};
const forms = {
  ...strata,
  name: "form-filling-agent",
  pid: 300,
  taken: "2026-10-15T11:56:00Z",
  wants: [{ resource: "browser", gb: null }],
  note: "Form filler",
  orphaned: "2026-10-15T11:58:00Z",
};
const bench = { name: "bench", pid: 200, wants: [{ resource: "ram", gb: 10 }], note: "", since: "x", seen: "x" };

test("one row: free and leased RAM, each holder, the GPU, who waits; stuck ones first and said once at the end", async () => {
  const band = bandOf(state([strata, forms], [bench]), NOW);
  expect(band?.parts).toEqual([
    { key: "ram", text: "RAM 1 GB free, 40 leased", tone: "ok" },
    { key: "form-filling-agent/300", text: "WEB Form filler !", tone: "stuck" },
    { key: "cortex/100", text: "GPU Strata", tone: "ok" },
    { key: "waiting", text: "waiting: bench", tone: "ok" },
  ]);
  expect(band?.tone).toBe("stuck");
  expect(band?.problem).toBe("stuck: its holder is gone, its job still runs");
  const late = bandOf(state([{ ...strata, renewed: "2026-10-15T11:58:30Z" }]), NOW);
  expect(late?.problem).toBe("stuck: no check-in for over a minute");
  const over = bandOf(state([{ ...strata, until: "2026-10-15T11:50:00Z" }]), NOW);
  expect(over?.problem).toBe("over the time it gave");
  expect(bandOf(state([]), NOW)).toBe(null); // nothing held: no band
  const game = JSON.stringify({ ...JSON.parse(state([])), gpu_used_gb: 18.2 });
  expect(bandOf(game, NOW)).toMatchObject({
    parts: [{ key: "ram" }, { key: "gpu", text: "GPU ▲ no lock", tone: "unlocked" }],
    tone: "unlocked",
    problem: "",
  });
  const held = JSON.stringify({ ...JSON.parse(state([strata])), gpu_used_gb: 23 });
  expect(bandOf(held, NOW)?.parts.map((p) => p.text)).toEqual(["RAM 1 GB free, 40 leased", "GPU Strata"]); // not "no lock"
  expect(bandOf(null, NOW)).toBe(null);
  expect(bandOf("{broken", NOW)?.unreadable).toBe(true);
});

test("a RAM holder shows its status after its name, and the GPU shows free", async () => {
  const builds = { ...strata, name: "kaizen-ci", note: "a VM for builds, with a long note", status: "1/2" };
  const band = bandOf(state([{ ...builds, wants: [{ resource: "ram", gb: 12 }] }]), NOW);
  expect(band?.parts.map((p) => p.text)).toEqual(["RAM 1 GB free, 12 leased", "kaizen-ci 1/2", "GPU ·"]);
});

test("two holders stuck alike say it once; a long status is cut; a stale measurement shows no GPU", async () => {
  const late = { ...strata, renewed: "2026-10-15T11:58:30Z" };
  const band = bandOf(state([late, { ...late, name: "other", pid: 5, status: "a very long status line" }]), NOW);
  expect(band?.problem).toBe("stuck: no check-in for over a minute");
  expect(band?.parts.map((p) => p.text)).toContain("GPU Strata a very long !");
  const stale = JSON.stringify({
    ...JSON.parse(state([{ ...strata, wants: [{ resource: "ram", gb: 4 }] }])),
    measured: "2026-10-15T11:00:00Z",
  });
  expect(bandOf(stale, NOW)?.parts.map((p) => p.text)).toEqual(["Strata"]);
});

test("the first version's file is read too, so install order does not matter", async () => {
  const v1 = JSON.stringify({ version: 1, holder: { ...strata, wants: undefined, gb: 40 }, waiting: [], free_gb: 1 });
  expect(bandOf(v1, NOW)?.parts.map((p) => p.text)).toEqual(["GPU Strata"]); // no measurement: no RAM part
});

test("the band draws the row on every surface, and nothing when nothing is held", async ($, on) => {
  let text = state([strata, forms]);
  on("fs.read", async () => ({ value: text }));
  on("env.get", async (_$, e) => ({ value: e.name === "LEASES_HOME" ? undefined : "C:/Users/someone" }));
  on("clock.now", async () => ({ value: NOW }));
  on("clock.every", async () => ({ value: undefined }));
  on("session.start", async (_$, e) => ({ cwd: e.cwd }));
  on("ui.render", async ($, e) => $.ui.resolve(e).Text({ children: "engine" })); // what the engine draws when the band passes
  const band = {
    plugin: "lease",
    component: "AbovePrompt",
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 10,
      bodyColumns: 100,
      scroll: { offset: 0, bodyRows: 9 },
      view: {},
    },
  } as const;
  await $.session.start({ cwd: "C:/", surface: "terminal", isInteractive: true });
  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await $.ui.mount({ ...band, surface });
    expect(await ui.find({ type: "Text", text: /GPU Strata/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /its holder is gone/ })).toBeDefined();
    expect(await ui.findAll({ type: "Button" })).toHaveLength(0);
    await ui.unmount();
  }
  text = state([]);
  await $.session.start({ cwd: "C:/", surface: "terminal", isInteractive: true });
  const ui = await $.ui.mount({ ...band, surface: "terminal" });
  expect(await ui.find({ type: "Text", text: /Strata/ })).toBeUndefined();
  expect(await ui.find({ type: "Text", text: "engine" })).toBeDefined();
  await ui.unmount();
});
