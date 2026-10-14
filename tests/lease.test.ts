import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import {
  forceFree,
  free,
  main,
  parseState,
  readLog,
  renew,
  type System,
  show,
  take,
  takeOnce,
} from "../src/lease/lease.mjs";

type Fake = System & { clock: number; living: Set<number>; starts: Map<number, string>; stopped: number[] };

function fake(): Fake {
  const f: Fake = {
    clock: Date.parse("2026-10-15T12:00:00Z"),
    living: new Set([100, 200, 300, 900]),
    starts: new Map([[900, "start-of-900"]]),
    stopped: [],
    now: () => f.clock,
    alive: (pid) => f.living.has(pid),
    started: (pid) => f.starts.get(pid) ?? null,
    stop: (pid) => {
      f.stopped.push(pid);
      f.living.delete(pid);
      return true;
    },
    freeGb: () => 41.2,
    sleep: (ms) => {
      f.clock += ms;
    },
  };
  return f;
}

const cortex = { name: "cortex", pid: 100, gb: 40, note: "Strata", ttl: 120 };
const bench = { name: "bench", pid: 200, gb: 10, note: "Docker batch", ttl: 120 };
let sys: Fake;

beforeEach(() => {
  process.env.LEASES_HOME = mkdtempSync(join(tmpdir(), "leases-"));
  sys = fake();
});

const events = () => readLog(100).map((l) => `${l.event} ${l.name}`);

describe("one holder", () => {
  test("a second taker is refused and listed as waiting, then gets it once the first frees it", () => {
    expect(takeOnce(cortex, sys).outcome).toBe("taken");
    const refused = takeOnce(bench, sys);
    expect(refused.outcome).toBe("held");
    expect(refused.view.waiting.map((w) => w.name)).toEqual(["bench"]);
    expect(free({ name: "cortex", pid: 100 }, sys).outcome).toBe("freed");
    expect(takeOnce(bench, sys).outcome).toBe("taken");
    expect(show(sys).view.waiting).toEqual([]);
    expect(events()).toEqual(["take cortex", "wait bench", "free cortex", "take bench"]);
  });

  test("taking it again while holding it renews it, so one program cannot lock itself out", () => {
    takeOnce(cortex, sys);
    expect(takeOnce(cortex, sys).outcome).toBe("renewed");
  });

  test("only the holder renews or frees it; anyone else is told it is not theirs", () => {
    takeOnce(cortex, sys);
    expect(renew({ name: "bench", pid: 200, ttl: 120, jobPid: null }, sys).outcome).toBe("lost");
    expect(renew({ name: "cortex", pid: 999, ttl: 120, jobPid: null }, sys).outcome).toBe("lost");
    expect(free({ name: "bench", pid: 200 }, sys).outcome).toBe("not-held");
    expect(show(sys).view.holder?.name).toBe("cortex");
  });

  test("a waiter who asked first is served first", () => {
    takeOnce(cortex, sys);
    takeOnce(bench, sys);
    takeOnce({ ...bench, name: "other", pid: 300 }, sys);
    free({ name: "cortex", pid: 100 }, sys);
    expect(takeOnce({ ...bench, name: "other", pid: 300 }, sys).outcome).toBe("behind");
    expect(takeOnce(bench, sys).outcome).toBe("taken");
  });
});

describe("never stuck", () => {
  test("a holder that stops renewing lapses two minutes after its last renewal", () => {
    takeOnce(cortex, sys);
    sys.clock += 90_000;
    expect(renew({ name: "cortex", pid: 100, ttl: 120, jobPid: null }, sys).outcome).toBe("renewed");
    sys.clock += 119_000;
    expect(show(sys).view.status).toBe("held");
    sys.clock += 2_000;
    expect(show(sys).view.status).toBe("free");
    expect(events()).toContain("expire cortex");
    expect(renew({ name: "cortex", pid: 100, ttl: 120, jobPid: null }, sys).outcome).toBe("lost");
  });

  test("a late renewal is logged as a gap", () => {
    takeOnce(cortex, sys);
    sys.clock += 100_000;
    renew({ name: "cortex", pid: 100, ttl: 120, jobPid: null }, sys);
    expect(events()).toContain("renew-gap cortex");
  });

  test("a holder whose process is gone frees it at once", () => {
    takeOnce(cortex, sys);
    sys.living.delete(100);
    expect(takeOnce(bench, sys).outcome).toBe("taken");
    expect(events()).toContain("holder-gone cortex");
  });

  test("a gone holder whose declared job still runs is orphaned: still held, until forced free with its job stopped", () => {
    takeOnce(cortex, sys);
    renew({ name: "cortex", pid: 100, ttl: 120, jobPid: 900 }, sys);
    sys.living.delete(100);
    expect(show(sys).view.status).toBe("orphaned");
    expect(takeOnce(bench, sys).outcome).toBe("held");
    const freed = forceFree({ by: "Colin", stopJob: true, cooldown: 0 }, sys);
    expect(freed.outcome).toBe("freed");
    expect(sys.stopped).toEqual([900]);
    expect(events()).toEqual(expect.arrayContaining(["orphaned cortex", "forced-free cortex", "job-stopped cortex"]));
  });

  test("a job pid now used by another program is not the job: the lease is freed, nothing is stopped", () => {
    takeOnce(cortex, sys);
    renew({ name: "cortex", pid: 100, ttl: 120, jobPid: 900 }, sys);
    sys.living.delete(100);
    sys.starts.set(900, "another program");
    expect(show(sys).view.status).toBe("free");
    expect(sys.stopped).toEqual([]);
  });

  test("a forced free tells the holder on its next renewal, and a cooldown keeps it from taking it straight back", () => {
    takeOnce(bench, sys);
    expect(forceFree({ by: "Colin", stopJob: true, cooldown: 600 }, sys).outcome).toBe("freed");
    expect(sys.stopped).toEqual([]); // bench declared no job: nothing of its is stopped
    expect(renew({ name: "bench", pid: 200, ttl: 120, jobPid: null }, sys).outcome).toBe("lost");
    expect(takeOnce(bench, sys).outcome).toBe("cooldown");
    expect(takeOnce(cortex, sys).outcome).toBe("taken");
    free({ name: "cortex", pid: 100 }, sys);
    sys.clock += 601_000;
    expect(takeOnce(bench, sys).outcome).toBe("taken");
  });

  test("a waiter that stopped asking is dropped and blocks nobody", () => {
    takeOnce(cortex, sys);
    takeOnce(bench, sys);
    free({ name: "cortex", pid: 100 }, sys);
    sys.clock += 151_000;
    expect(takeOnce({ ...bench, name: "other", pid: 300 }, sys).outcome).toBe("taken");
  });
});

describe("waiting", () => {
  test("a taker waits while it is held, and gets it when the holder lapses", () => {
    takeOnce(cortex, sys);
    expect(take(bench, 300, sys).outcome).toBe("taken");
    expect(sys.clock - Date.parse("2026-10-15T12:00:00Z")).toBeGreaterThan(120_000);
  });

  test("a taker that gives up leaves the waiting list", () => {
    takeOnce(cortex, sys);
    expect(take(bench, 10, sys).outcome).toBe("held");
    expect(show(sys).view.waiting).toEqual([]);
    expect(events()).toContain("gave-up bench");
  });
});

describe("the file", () => {
  test("a state of the wrong shape is refused at the edge", () => {
    const good = JSON.stringify({
      version: 1,
      holder: null,
      waiting: [],
      cooldowns: [],
      free_gb: null,
      measured: null,
    });
    expect(parseState(good).holder).toBeNull();
    expect(() => parseState('{"version": 1, "holder": {"name": "x", "pid": "7"}, "waiting": []}')).toThrow();
    expect(() => parseState('{"version": 2, "holder": null, "waiting": []}')).toThrow();
    expect(() => parseState('{"version": 1, "holder": null, "waiting": [{"name": 1}]}')).toThrow();
    expect(() => parseState("not json")).toThrow();
  });

  test("a broken file is kept aside and the lease starts empty, so nothing waits on it forever", () => {
    writeFileSync(join(process.env.LEASES_HOME ?? "", "state.json"), "{broken", "utf8");
    expect(takeOnce(cortex, sys).outcome).toBe("taken");
    expect(events()[0]).toBe("reset ");
  });

  test("the state is written whole, with free RAM measured", () => {
    takeOnce(cortex, sys);
    const state = parseState(readFileSync(join(process.env.LEASES_HOME ?? "", "state.json"), "utf8"));
    expect(state.holder?.gb).toBe(40);
    expect(state.free_gb).toBe(41.2);
  });
});

describe("the command", () => {
  const run = (...argv: string[]) => {
    const out: string[] = [];
    const code = main(argv, (t) => out.push(t), sys);
    return { code, out: out.join("\n") };
  };

  test("take, show, free with --json, and the exit codes", () => {
    expect(run("take", "--name", "cortex", "--pid", "100", "--gb", "40", "--json").code).toBe(0);
    const held = run("take", "--name", "bench", "--pid", "200", "--gb", "10", "--json");
    expect(held.code).toBe(1);
    expect(JSON.parse(held.out).view.holder.name).toBe("cortex");
    expect(run("renew", "--name", "bench", "--pid", "200").code).toBe(3);
    expect(run("show").out).toMatch(/^shown: held by cortex \(pid 100\) · 40 GB · 2 min left · 41 GB free$/); // a take with no --wait does not stay in line
    expect(run("free", "--force", "--by", "Colin").code).toBe(0);
    expect(run("log").out).toMatch(/forced-free cortex \(pid 100\) by Colin/);
  });

  test("bad arguments say what was wrong and exit 2", () => {
    expect(run("take", "--name", "x").out).toMatch(/needs --gb/);
    expect(run("take", "--name", "x", "--gb", "lots").code).toBe(2);
    expect(run("grab").code).toBe(2);
    expect(run("show", "--bogus").code).toBe(2);
  });
});
