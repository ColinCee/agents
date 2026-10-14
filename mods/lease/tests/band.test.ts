import { expect, test } from "claude-code/testing";
import { bandOf, freeWords } from "../hooks/band";

const NOW = Date.parse("2026-10-15T12:00:00Z");
const held = JSON.stringify({
  version: 1,
  holder: {
    name: "cortex",
    pid: 100,
    taken: "2026-10-15T11:48:00Z",
    renewed: "2026-10-15T11:59:50Z",
    expires: "2026-10-15T12:01:50Z",
    gb: 40,
    note: "Strata",
    job: { pid: 900, started: "x" },
    orphaned: null,
  },
  waiting: [{ name: "bench", pid: 200, gb: 10, note: "", since: "2026-10-15T11:59:00Z", seen: "2026-10-15T11:59:58Z" }],
  cooldowns: [],
  free_gb: 1.4,
  measured: "2026-10-15T11:59:50Z",
});
const free = JSON.stringify({
  version: 1,
  holder: null,
  waiting: [],
  cooldowns: [],
  free_gb: 41.2,
  measured: "2026-10-15T11:59:58Z",
});
const BAND = {
  plugin: "lease",
  component: "AbovePrompt",
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { bodyRows: 9 } },
} as const;

test("the band says who holds it, for how long, who waits and the free RAM", async () => {
  const band = bandOf(held, NOW);
  expect(band?.line).toBe("GPU+RAM: Strata (cortex) · 40 GB · held 12 min · 1 GB free");
  expect(band?.waiting).toBe("bench (10 GB)");
  expect(band && freeWords(band)).toBe("Stop cortex's job and free it?");
  expect(bandOf(null, NOW)).toBe(null);
  expect(bandOf("{broken", NOW)?.kind).toBe("unreadable");
});

test("held: Free it asks first, then runs the lease command; free: one line and no button", async ($, on) => {
  let text = held;
  const ran: string[][] = [];
  on("fs.read", async () => ({ value: text }));
  on("env.get", async (_$, e) => ({ value: e.name === "LEASES_HOME" ? undefined : "C:/Users/someone" }));
  on("clock.now", async () => ({ value: NOW }));
  on("clock.every", async () => ({ value: undefined }));
  on("session.start", async (_$, e) => ({ cwd: e.cwd }));
  on("process.run", async (_$, e) => {
    ran.push([...e.argv]);
    return {
      value: { exitCode: 0, stdout: "freed: free", stderr: "", isStdoutTruncated: false, isStderrTruncated: false },
    };
  });
  await $.session.start({ cwd: "C:/", surface: "terminal", isInteractive: true });
  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await $.ui.mount({ ...BAND, surface });
    expect(await ui.find({ key: "free" })).toBeDefined();
    await ui.unmount();
  }
  const asked = await $.ui.mount({ ...BAND, surface: "desktop" });
  await asked.press({ key: "free" });
  expect(ran).toEqual([]);
  await asked.press({ key: "yes" });
  expect(ran).toEqual([
    [
      "node",
      "C:/Users/someone/.leases/lease.mjs",
      "free",
      "--force",
      "--stop-job",
      "--by",
      "Colin (Claude Code)",
      "--cooldown",
      "600",
    ],
  ]);
  expect(await asked.find({ type: "Text", text: /freed: free/ })).toBeDefined();
  await asked.unmount();

  text = free;
  await $.session.start({ cwd: "C:/", surface: "terminal", isInteractive: true });
  const ui = await $.ui.mount({ ...BAND, surface: "terminal" });
  expect(await ui.find({ key: "free" })).toBeUndefined();
  expect(await ui.find({ type: "Text", text: /GPU\+RAM: free · 41 GB free/ })).toBeDefined();
  await ui.unmount();
});
