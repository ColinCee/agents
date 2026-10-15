import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import {
  forceFree,
  free,
  legacyWants,
  main,
  parseState,
  readLog,
  renew,
  type System,
  show,
  take,
  takeOnce,
} from "../src/lease/lease.mjs";

type Fake = System & {
  freeGb_: number;
  clock: number;
  living: Set<number>;
  starts: Map<number, string>;
  stopped: number[];
};

function fake(): Fake {
  const f: Fake = {
    freeGb_: 41.2,
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
    freeGb: () => f.freeGb_,
    totalGb: () => 63.7,
    sleep: (ms) => {
      f.clock += ms;
    },
  };
  return f;
}

// The first version's callers: the GPU and RAM together, as `--gb` alone still means.
const cortex = { name: "cortex", pid: 100, wants: legacyWants(40), note: "Strata", ttl: 120 };
const bench = { name: "bench", pid: 200, wants: legacyWants(10), note: "Docker batch", ttl: 120 };
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
    expect(parseState(good).holds).toEqual([]);
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
    expect(state.holds[0]?.wants).toEqual(legacyWants(40));
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
    expect(run("show").out).toMatch(/^shown: gpu ram:40 held by cortex \(pid 100\) · 2 min left · 41 GB free$/); // a take with no --wait does not stay in line
    expect(run("free", "--force", "--by", "Colin").code).toBe(0);
    expect(run("log").out).toMatch(/forced-free cortex \(pid 100\) by Colin/);
  });

  test("bad arguments say what was wrong and exit 2", () => {
    expect(run("take", "--name", "x").out).toMatch(/needs --res/);
    expect(run("take", "--name", "x", "--gb", "lots").code).toBe(2);
    expect(run("grab").code).toBe(2);
    expect(run("show", "--bogus").code).toBe(2);
  });
});

describe("named resources", () => {
  const ramOnly = { name: "bench", pid: 200, wants: [{ resource: "ram", gb: 10 }], note: "batch", ttl: 120 };
  const web = { name: "forms", pid: 300, wants: [{ resource: "browser", gb: null }], note: "", ttl: 120 };
  /** Let time pass while the named holders renew every 30 s, as real ones do. */
  const pass = (seconds: number, ...holders: { name: string; pid: number }[]) => {
    for (let s = 0; s < seconds; s += 30) {
      sys.clock += Math.min(30, seconds - s) * 1000;
      for (const h of holders) renew({ ...h, ttl: 120, jobPid: null }, sys);
    }
  };

  test("holds of different resources do not wait on each other; the same one has one holder", () => {
    expect(takeOnce(cortex, sys).outcome).toBe("taken");
    expect(takeOnce(web, sys).outcome).toBe("taken");
    expect(takeOnce({ ...web, name: "other", pid: 900 }, sys).outcome).toBe("held");
    expect(show(sys).view.holds.map((h) => h.name)).toEqual(["cortex", "forms"]);
  });

  test("a RAM share beside another needs room in the pool and that much really free", () => {
    takeOnce(cortex, sys);
    sys.freeGb_ = 1; // the model loaded, and used more than it said
    pass(300, cortex);
    expect(takeOnce(ramOnly, sys).outcome).toBe("held");
    sys.freeGb_ = 20;
    expect(takeOnce(ramOnly, sys).outcome).toBe("taken");
    expect(takeOnce({ ...ramOnly, name: "big", pid: 900, wants: [{ resource: "ram", gb: 16 }] }, sys).outcome).toBe(
      "held",
    ); // 40 + 10 + 16 is more than the 55 GB pool of a 64 GB machine
  });

  test("a RAM share taken moments ago counts as used, though it is not yet", () => {
    takeOnce(ramOnly, sys); // its containers have not started: the RAM still shows free
    expect(takeOnce(cortex, sys).outcome).toBe("held"); // 41 free less 10 loading is short of 40
    pass(121, ramOnly);
    expect(takeOnce(cortex, sys).outcome).toBe("taken");
  });

  test("taking several is all or none: a taker never holds half and waits on the rest", () => {
    takeOnce(web, sys);
    const both = {
      name: "agent",
      pid: 900,
      wants: [
        { resource: "gpu", gb: null },
        { resource: "browser", gb: null },
      ],
    };
    expect(takeOnce({ ...both, note: "", ttl: 120 }, sys).outcome).toBe("held");
    expect(show(sys).view.holds.map((h) => h.name)).toEqual(["forms"]); // it holds no GPU while it waits
    expect(takeOnce(cortex, sys).outcome).toBe("behind"); // first come, first served on the GPU it asked for first
  });

  test("a stuck hold is shown, never freed: late, past its time, or orphaned", () => {
    takeOnce({ ...web, forSeconds: 600 }, sys);
    sys.clock += 61_000;
    expect(show(sys).view.holds[0]?.health).toBe("late");
    renew({ name: "forms", pid: 300, ttl: 120, jobPid: null }, sys);
    expect(show(sys).view.holds[0]?.health).toBe("ok");
    pass(600, web);
    expect(show(sys).view.holds[0]?.health).toBe("over");
    expect(events().filter((e) => e === "over-time forms")).toHaveLength(1);
    renew({ name: "forms", pid: 300, ttl: 120, jobPid: null, forSeconds: 300 }, sys);
    expect(show(sys).view.holds[0]?.health).toBe("ok");
  });

  test("Cortex's free at start reaches its own orphaned hold, not another program's RAM share", () => {
    takeOnce(ramOnly, sys);
    pass(121, ramOnly);
    takeOnce(cortex, sys);
    renew({ name: "cortex", pid: 100, ttl: 120, jobPid: 900 }, sys);
    sys.living.delete(100);
    const seen = show(sys).view;
    expect([seen.status, seen.holder?.name]).toEqual(["orphaned", "cortex"]);
    expect(forceFree({ by: "cortex at start", stopJob: true, cooldown: 0 }, sys).outcome).toBe("freed");
    expect(sys.stopped).toEqual([900]);
    expect(show(sys).view.holds.map((h) => h.name)).toEqual(["bench"]);
  });

  test("a forced free can name the hold, as the band's Free it does", () => {
    takeOnce(cortex, sys);
    takeOnce(web, sys);
    expect(
      forceFree({ by: "Colin", stopJob: false, cooldown: 0, target: { name: "forms", pid: 300 } }, sys).outcome,
    ).toBe("freed");
    expect(show(sys).view.holds.map((h) => h.name)).toEqual(["cortex"]);
    expect(
      forceFree({ by: "Colin", stopJob: false, cooldown: 0, target: { name: "nobody", pid: null } }, sys).outcome,
    ).toBe("not-held");
  });

  test("resources are remembered with a label, and forgotten after a month unused", () => {
    takeOnce({ ...web, labels: { browser: "WEB" } }, sys);
    takeOnce(cortex, sys);
    free({ name: "forms", pid: 300 }, sys);
    expect(show(sys).view.resources.map((r) => `${r.name}=${r.label}`)).toEqual(["browser=WEB", "gpu=GPU", "ram=RAM"]);
    free({ name: "cortex", pid: 100 }, sys);
    sys.clock += 31 * 86_400_000;
    expect(show(sys).view.resources).toEqual([]);
  });
});

describe("the first version's file and callers", () => {
  // The state file as the first version left it on 15 October, with a model holding the lease.
  const v1 = {
    version: 1,
    holder: {
      name: "cortex",
      pid: 100,
      taken: "2026-10-15T11:58:00.000Z",
      renewed: "2026-10-15T11:59:50.000Z",
      expires: "2026-10-15T12:01:50.000Z",
      gb: 40,
      note: "Strata",
      job: { pid: 900, started: "start-of-900" },
      orphaned: null,
    },
    waiting: [
      { name: "bench", pid: 200, gb: 10, note: "", since: "2026-10-15T11:59:00Z", seen: "2026-10-15T11:59:58Z" },
    ],
    cooldowns: [],
    free_gb: 0.7,
    measured: "2026-10-15T11:59:50.000Z",
  };

  test("a lease held when this version replaces the first stays held, with its job, and nothing is reset", () => {
    writeFileSync(join(process.env.LEASES_HOME ?? "", "state.json"), JSON.stringify(v1), "utf8");
    const seen = show(sys).view;
    expect(seen.holds).toHaveLength(1);
    expect(seen.holds[0]).toMatchObject({ name: "cortex", wants: legacyWants(40), job: { pid: 900 } });
    expect(seen.waiting[0]?.wants).toEqual(legacyWants(10));
    expect(events()).toEqual([]);
    expect(renew({ name: "cortex", pid: 100, ttl: 120, jobPid: 900 }, sys).outcome).toBe("renewed");
  });

  test("--json keeps the fields Cortex reads: outcome, status, holder and waiting names", () => {
    const out: string[] = [];
    main(
      ["take", "--name", "cortex", "--pid", "100", "--gb", "40", "--note", "Strata", "--json"],
      (t) => out.push(t),
      sys,
    );
    main(["take", "--name", "bench", "--pid", "200", "--res", "gpu", "--json"], (t) => out.push(t), sys);
    const answer = JSON.parse(out[1] ?? "");
    expect(answer.outcome).toBe("held");
    expect(answer.view.status).toBe("held");
    expect(answer.view.holder).toMatchObject({ name: "cortex", pid: 100, gb: 40, note: "Strata", job: null });
    takeOnce({ name: "bench", pid: 200, wants: [{ resource: "gpu", gb: null }], note: "", ttl: 120 }, sys);
    main(["show", "--json"], (t) => out.push(t), sys);
    expect(JSON.parse(out[2] ?? "").view.waiting.map((w: { name: string }) => w.name)).toEqual(["bench"]);
  });

  test("--res and --label are read, and bad ones say what was expected", () => {
    const run = (...argv: string[]) => {
      const out: string[] = [];
      return { code: main(argv, (t) => out.push(t), sys), out: out.join("\n") };
    };
    expect(run("take", "--name", "f", "--pid", "300", "--res", "browser", "--label", "browser=WEB").code).toBe(0);
    expect(show(sys).view.resources[0]?.label).toBe("WEB");
    expect(run("take", "--name", "x", "--res", "ram").out).toMatch(/needs a size/);
    expect(run("take", "--name", "x", "--res", "gpu:4").out).toMatch(/only ram is shared by size/);
    expect(run("take", "--name", "x", "--res", "GPU").code).toBe(2);
    expect(run("take", "--name", "x", "--res", "gpu", "--gb", "4").out).toMatch(/not both/);
    expect(run("take", "--name", "x", "--res", "gpu", "--label", "gpu=toolong").code).toBe(2);
  });
});
