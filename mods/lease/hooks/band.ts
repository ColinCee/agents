import type { Band, Part, Tone } from "../types";

// Read, never written: the lease command owns the file and its lock. Both its versions are read, so the band works
// whichever was installed first.

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };
type Want = { resource: string; gb: number | null };

const isObj = (v: Json | undefined): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: Json | undefined): string => (typeof v === "string" ? v : "");
const num = (v: Json | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const objs = (v: Json | undefined): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);

const FRESH_MS = 5 * 60_000; // a measurement older than this is not shown: nobody has run the command since
const LATE_MS = 60_000; // two missed renewals, as the lease command counts it
const GPU_BUSY_GB = 6; // as the lease command counts it: Windows' desktop alone holds 3.3 GB of the card
const NAME_MAX = 16; // a holder's note when it is this short, else its name: the row stays one line
const STATUS_MAX = 12; // a holder's status, so a long one cannot push the GPU off the row

const legacy = (gb: number): Want[] => [
  { resource: "gpu", gb: null },
  { resource: "ram", gb },
];

function wantsOf(v: Json | undefined, gb: Json | undefined): Want[] {
  if (!Array.isArray(v)) return legacy(num(gb) ?? 0);
  return objs(v).map((w) => ({ resource: str(w.resource), gb: num(w.gb) }));
}

const PROBLEM = {
  orphaned: "stuck: its holder is gone, its job still runs",
  late: "stuck: no check-in for over a minute",
  over: "over the time it gave",
} as const;

/** The band for the state file's text at `now`: one row of short parts (free and leased RAM, each holder, the GPU, who
 * waits) with anything wrong said once at its end, or null when nothing is held and the GPU is quiet (no band). */
export function bandOf(text: string | null, now: number): Band | null {
  if (text === null) return null;
  let raw: Json;
  try {
    raw = JSON.parse(text) as Json;
  } catch {
    return { parts: [], tone: "stuck", problem: "", unreadable: true };
  }
  if (!isObj(raw)) return null;
  const labels = new Map(objs(raw.resources).map((r) => [str(r.name), str(r.label)]));
  const label = (r: string) => labels.get(r) ?? r.replace(/-/g, "").slice(0, 3).toUpperCase();
  const holds = (raw.version === 1 ? (isObj(raw.holder) ? [raw.holder] : []) : objs(raw.holds)).map((h) => ({
    h,
    wants: wantsOf(h.wants, h.gb),
  }));
  const gpuHeld = holds.some((x) => x.wants.some((w) => w.resource === "gpu"));
  const fresh = now - Date.parse(str(raw.measured)) < FRESH_MS;
  const gpuUsed = num(raw.gpu_used_gb);
  const gpuUnlocked = fresh && gpuUsed !== null && gpuUsed > GPU_BUSY_GB && !gpuHeld;
  if (holds.length === 0 && !gpuUnlocked) return null;

  const holders = holds.map(({ h, wants }) => {
    const until = typeof h.until === "string" ? Date.parse(h.until) : null;
    const stuck =
      typeof h.orphaned === "string"
        ? "orphaned"
        : now - Date.parse(str(h.renewed)) > LATE_MS
          ? "late"
          : until !== null && now > until
            ? "over"
            : null;
    const note = str(h.note);
    const who = note !== "" && note.length <= NAME_MAX ? note : str(h.name);
    // RAM is in its own part; every other resource held is named before its holder: "GPU Strata", "WEB Form filler".
    const what = wants.filter((w) => w.resource !== "ram").map((w) => label(w.resource));
    const part: Part = {
      key: `${str(h.name)}/${num(h.pid) ?? 0}`,
      text: [...what, who, str(h.status).slice(0, STATUS_MAX).trim(), stuck === null ? "" : "!"]
        .filter(Boolean)
        .join(" "),
      tone: stuck === null ? "ok" : "stuck",
    };
    return { part, problem: stuck === null ? "" : PROBLEM[stuck], taken: Date.parse(str(h.taken)) };
  });
  // Stuck first, then the oldest: parts keep their places as others come and go.
  holders.sort((a, b) => Number(b.part.tone === "stuck") - Number(a.part.tone === "stuck") || a.taken - b.taken);
  const problems = [...new Set(holders.map((x) => x.problem).filter(Boolean))];

  const parts: Part[] = [];
  const free = num(raw.free_gb);
  if (free !== null && fresh) {
    const leased = holds.reduce((sum, x) => sum + (x.wants.find((w) => w.resource === "ram")?.gb ?? 0), 0);
    const text = `RAM ${Math.round(free)} GB free${leased > 0 ? `, ${Math.round(leased)} leased` : ""}`;
    parts.push({ key: "ram", text, tone: "ok" });
  }
  parts.push(...holders.map((x) => x.part));
  // Something uses the card and nobody holds the GPU: a program that took no lock, or a game.
  if (gpuUnlocked) parts.push({ key: "gpu", text: "GPU ▲ no lock", tone: "unlocked" });
  else if (!gpuHeld && fresh) parts.push({ key: "gpu", text: "GPU ·", tone: "ok" });
  const waiting = objs(raw.waiting).map((w) => str(w.name));
  if (waiting.length > 0) parts.push({ key: "waiting", text: `waiting: ${waiting.join(", ")}`, tone: "ok" });

  const any = (t: Tone) => parts.some((p) => p.tone === t);
  const tone: Tone = any("stuck") ? "stuck" : any("unlocked") ? "unlocked" : "ok";
  return { parts, tone, problem: problems.join(" · "), unreadable: false };
}
