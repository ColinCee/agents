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

test("one line per holder: what it holds, for how long, free RAM, who waits; stuck ones first", async () => {
  const band = bandOf(state([strata, forms], [bench]), NOW);
  expect(band?.lines).toEqual([
    {
      key: "form-filling-agent/300",
      tone: "stuck",
      text: "Form filler · WEB · 4 min",
      problem: "stuck: its holder is gone, its job still runs",
    },
    {
      key: "cortex/100",
      tone: "ok",
      text: "Strata · GPU + RAM 40 GB · 12 min · 1 GB RAM free · waiting: bench",
      problem: "",
    },
  ]);
  const late = bandOf(state([{ ...strata, renewed: "2026-10-15T11:58:30Z" }]), NOW);
  expect(late?.lines[0]?.problem).toBe("stuck: no check-in for over a minute");
  const over = bandOf(state([{ ...strata, until: "2026-10-15T11:50:00Z" }]), NOW);
  expect(over?.lines[0]?.problem).toBe("over the time it gave");
  expect(bandOf(state([]), NOW)).toBe(null); // nothing held: no band
  const game = JSON.stringify({ ...JSON.parse(state([])), gpu_used_gb: 18.2 });
  expect(bandOf(game, NOW)?.lines).toEqual([
    { key: "gpu-unlocked", tone: "unlocked", text: "GPU in use · 18 GB", problem: "no lock" },
  ]);
  const held = JSON.stringify({ ...JSON.parse(state([strata])), gpu_used_gb: 23 });
  expect(bandOf(held, NOW)?.lines).toHaveLength(1); // its own model: not "no lock"
  expect(bandOf(null, NOW)).toBe(null);
  expect(bandOf("{broken", NOW)?.unreadable).toBe(true);
});

test("the first version's file is read too, so install order does not matter", async () => {
  const v1 = JSON.stringify({ version: 1, holder: { ...strata, wants: undefined, gb: 40 }, waiting: [], free_gb: 1 });
  expect(bandOf(v1, NOW)?.lines[0]?.text).toBe("Strata · GPU + RAM 40 GB · 12 min");
});

test("the band draws the lines on every surface, and nothing when nothing is held", async ($, on) => {
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
    expect(await ui.find({ type: "Text", text: /Strata · GPU \+ RAM 40 GB · 12 min/ })).toBeDefined();
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
