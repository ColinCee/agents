import type { Band, Line, Stuck } from "../types";

// Read, never written: the lease command owns the file and its lock. Both its versions are read, so the band works
// whichever was installed first.

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };
type Want = { resource: string; gb: number | null };

const isObj = (v: Json | undefined): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: Json | undefined): string => (typeof v === "string" ? v : "");
const num = (v: Json | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const objs = (v: Json | undefined): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);

const FRESH_MS = 5 * 60_000; // free RAM older than this is not shown: nobody has run the command since
const LATE_MS = 60_000; // two missed renewals, as the lease command counts it
const GPU_BUSY_GB = 6; // as the lease command counts it: Windows' desktop alone holds 3.3 GB of the card
const NAME_MAX = 24; // a holder's name on a line that also says what it holds and for how long

const legacy = (gb: number): Want[] => [
  { resource: "gpu", gb: null },
  { resource: "ram", gb },
];

function wantsOf(v: Json | undefined, gb: Json | undefined): Want[] {
  if (!Array.isArray(v)) return legacy(num(gb) ?? 0);
  return objs(v).map((w) => ({ resource: str(w.resource), gb: num(w.gb) }));
}

const short = (text: string) => (text.length > NAME_MAX ? `${text.slice(0, NAME_MAX - 1)}…` : text);

export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 90 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

const PROBLEM: Record<Exclude<Stuck, null>, string> = {
  orphaned: "stuck: its holder is gone, its job still runs",
  late: "stuck: no check-in for over a minute",
  over: "over the time it gave",
};

/** The band for the state file's text at `now`: one line per holder, stuck ones first, or null when nothing is
 * held (no band at all). */
export function bandOf(text: string | null, now: number): Band | null {
  if (text === null) return null;
  let raw: Json;
  try {
    raw = JSON.parse(text) as Json;
  } catch {
    return { lines: [], unreadable: true };
  }
  if (!isObj(raw)) return null;
  const labels = new Map(objs(raw.resources).map((r) => [str(r.name), str(r.label)]));
  const label = (r: string) => labels.get(r) ?? r.replace(/-/g, "").slice(0, 3).toUpperCase();
  const holds = raw.version === 1 ? (isObj(raw.holder) ? [raw.holder] : []) : objs(raw.holds);
  const waiters = objs(raw.waiting).map((w) => ({ name: str(w.name), wants: wantsOf(w.wants, w.gb) }));
  const freeGb = num(raw.free_gb);
  const fresh = freeGb !== null && now - Date.parse(str(raw.measured)) < FRESH_MS;
  const lines = holds.map((h) => {
    const wants = wantsOf(h.wants, h.gb);
    const until = typeof h.until === "string" ? Date.parse(h.until) : null;
    const stuck: Stuck =
      typeof h.orphaned === "string"
        ? "orphaned"
        : now - Date.parse(str(h.renewed)) > LATE_MS
          ? "late"
          : until !== null && now > until
            ? "over"
            : null;
    const what = wants.map((w) => (w.gb === null ? label(w.resource) : `${label(w.resource)} ${Math.round(w.gb)} GB`));
    const ram = wants.some((w) => w.resource === "ram") && fresh ? `${Math.round(freeGb ?? 0)} GB RAM free` : "";
    const waiting = waiters
      .filter((x) => x.wants.some((y) => wants.some((w) => w.resource === y.resource)))
      .map((x) => x.name);
    const parts = [
      short(str(h.note) || str(h.name)),
      what.join(" + "),
      ago(now - Date.parse(str(h.taken))),
      ram,
      waiting.length > 0 ? `waiting: ${waiting.join(", ")}` : "",
    ].filter(Boolean);
    const line: Line = {
      key: `${str(h.name)}/${num(h.pid) ?? 0}`,
      tone: stuck === null ? "ok" : "stuck",
      text: parts.join(" · "),
      problem: stuck === null ? "" : PROBLEM[stuck],
    };
    return { line, taken: Date.parse(str(h.taken)) };
  });
  // Stuck first, then the oldest: lines keep their places as others come and go.
  lines.sort((a, b) => Number(b.line.tone === "stuck") - Number(a.line.tone === "stuck") || a.taken - b.taken);
  // Something uses the card and nobody holds the GPU: a program that took no lock, or a game.
  const gpuHeld = holds.some((h) => wantsOf(h.wants, h.gb).some((w) => w.resource === "gpu"));
  const gpuUsed = num(raw.gpu_used_gb);
  const gpuFresh = now - Date.parse(str(raw.measured)) < FRESH_MS;
  if (!gpuHeld && gpuUsed !== null && gpuUsed > GPU_BUSY_GB && gpuFresh)
    lines.push({
      line: {
        key: "gpu-unlocked",
        tone: "unlocked",
        text: `GPU in use · ${Math.round(gpuUsed)} GB`,
        problem: "no lock",
      },
      taken: 0,
    });
  if (lines.length === 0) return null;
  return { lines: lines.map((l) => l.line), unreadable: false };
}
