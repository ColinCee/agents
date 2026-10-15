import { expect, test } from "claude-code/testing";
import { bandOf, cardLines, freeWords } from "../hooks/band";

const NOW = Date.parse("2026-10-15T12:00:00Z");
const state = (holds: object[], waiting: object[] = []) =>
  JSON.stringify({
    version: 2,
    holds,
    waiting,
    cooldowns: [],
    resources: [
      { name: "gpu", label: "GPU", used: "2026-10-15T11:59:50Z" },
      { name: "ram", label: "RAM", used: "2026-10-15T11:59:50Z" },
      { name: "browser", label: "WEB", used: "2026-10-15T11:00:00Z" },
      { name: "mic", label: "MIC", used: "2026-10-01T11:00:00Z" },
    ],
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
  renewed: "2026-10-15T11:58:00Z", // two minutes quiet: stuck
  wants: [{ resource: "browser", gb: null }],
  note: "",
  job: null,
};
const bench = { name: "bench", pid: 200, wants: [{ resource: "ram", gb: 10 }], note: "", since: "x", seen: "x" };

test("one chip per held resource: label over holder, stuck first, waiting counted, unused ones spare", async () => {
  const band = bandOf(state([strata, forms], [bench]), NOW);
  expect(band?.chips.map((c) => [c.label, c.holder, c.stuck, c.waiting.length])).toEqual([
    ["WEB", "form-filling-…", "late", 0],
    ["GPU", "Strata", null, 0],
    ["RAM · 40 GB", "Strata", null, 1],
  ]);
  expect(band?.spare.map((s) => s.label)).toEqual(["MIC"]);
  const ram = band?.chips[2];
  if (band && ram) {
    expect(cardLines(ram, band, NOW)).toEqual([
      "Strata (cortex, pid 100) holds gpu ram:40",
      "held 12 min · checked in 10 s ago",
      "waiting: bench",
      "1 GB of RAM free",
    ]);
    expect(freeWords(ram)).toBe("Stop Strata and free gpu ram:40?");
  }
  expect(bandOf(state([]), NOW)).toBe(null); // nothing held, nobody waiting: no band
  expect(bandOf(null, NOW)).toBe(null);
  expect(bandOf("{broken", NOW)?.unreadable).toBe(true);
});

test("the first version's file is read too, so install order does not matter", async () => {
  const v1 = JSON.stringify({ version: 1, holder: { ...strata, wants: undefined, gb: 40 }, waiting: [], free_gb: 1 });
  expect(bandOf(v1, NOW)?.chips.map((c) => c.label)).toEqual(["GPU", "RAM · 40 GB"]);
});

const BAND = {
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

test("a click opens the card; Free it asks first, then frees that hold by name", async ($, on) => {
  const ran: string[][] = [];
  on("fs.read", async () => ({ value: state([strata, forms]) }));
  on("env.get", async (_$, e) => ({ value: e.name === "LEASES_HOME" ? undefined : "C:/Users/someone" }));
  on("clock.now", async () => ({ value: NOW }));
  on("clock.every", async () => ({ value: undefined }));
  on("session.start", async (_$, e) => ({ cwd: e.cwd }));
  on("process.run", async (_$, e) => {
    ran.push([...e.argv]);
    return { value: { exitCode: 0, stdout: "freed", stderr: "", isStdoutTruncated: false, isStderrTruncated: false } };
  });
  await $.session.start({ cwd: "C:/", surface: "terminal", isInteractive: true });
  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await $.ui.mount({ ...BAND, surface });
    expect(await ui.find({ key: "free" })).toBeUndefined(); // no card until a click
    await ui.press({ key: "who:gpu/cortex/100" });
    expect(await ui.find({ type: "Text", text: /Strata \(cortex, pid 100\) holds gpu ram:40/ })).toBeDefined();
    await ui.press({ key: "who:gpu/cortex/100" }); // the same chip again closes it
    expect(await ui.find({ key: "free" })).toBeUndefined();
    await ui.unmount();
  }
  const ui = await $.ui.mount({ ...BAND, surface: "desktop" });
  await ui.press({ key: "spare" });
  expect(await ui.find({ type: "Text", text: "MIC" })).toBeDefined();
  await ui.press({ key: "chip:browser/form-filling-agent/300" });
  expect(await ui.find({ type: "Text", text: /not checked in for over a minute/ })).toBeDefined();
  await ui.press({ key: "free" });
  expect(ran).toEqual([]);
  await ui.press({ key: "yes" });
  expect(ran).toEqual([
    [
      "node",
      "C:/Users/someone/.leases/lease.mjs",
      "free",
      "--force",
      "--name",
      "form-filling-agent",
      "--pid",
      "300",
      "--stop-job",
      "--by",
      "Colin (Claude Code)",
      "--cooldown",
      "600",
    ],
  ]);
  expect(await ui.find({ type: "Text", text: /Freed browser from form-filling-agent/ })).toBeDefined();
  await ui.unmount();
});
