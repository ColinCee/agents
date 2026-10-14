import type { Band } from "../types";

// Read, never written: the lease command owns the file and its lock. Only what the band draws is taken from it.

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

const isObj = (v: Json | undefined): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: Json | undefined): string => (typeof v === "string" ? v : "");
const num = (v: Json | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

const FRESH_MS = 5 * 60_000; // free RAM older than this is not shown: nobody has run the command since
const RENEW_LATE_MS = 60_000; // two missed renewals

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 90 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** The band for the state file's text at `now`, or null when there is no lease file (nothing to show). */
export function bandOf(text: string | null, now: number): Band | null {
  if (text === null) return null;
  let raw: Json;
  try {
    raw = JSON.parse(text) as Json;
  } catch {
    return {
      kind: "unreadable",
      line: "GPU+RAM lease: the state file cannot be read",
      holder: "",
      job: false,
      waiting: "",
    };
  }
  if (!isObj(raw)) return null;
  const waiters = Array.isArray(raw.waiting) ? raw.waiting.filter(isObj) : [];
  const waiting = waiters.map((w) => `${str(w.name)} (${Math.round(num(w.gb) ?? 0)} GB)`).join(", ");
  const freeGb = num(raw.free_gb);
  const measured = Date.parse(str(raw.measured));
  const free = freeGb !== null && now - measured < FRESH_MS ? ` · ${Math.round(freeGb)} GB free` : "";
  const h = isObj(raw.holder) ? raw.holder : null;
  if (h === null) return { kind: "free", line: `GPU+RAM: free${free}`, holder: "", job: false, waiting };
  const name = str(h.name);
  const what = `${str(h.note) || name} (${name}) · ${Math.round(num(h.gb) ?? 0)} GB`;
  const job = isObj(h.job);
  if (typeof h.orphaned === "string") {
    const jobPid = isObj(h.job) ? num(h.job.pid) : null;
    return {
      kind: "orphaned",
      line: `GPU+RAM: ${what} · its holder is gone, its job ${jobPid ?? "?"} still runs${free}`,
      holder: name,
      job,
      waiting,
    };
  }
  const held = ago(now - Date.parse(str(h.taken)));
  const late = now - Date.parse(str(h.renewed));
  const quiet = late > RENEW_LATE_MS ? ` · not renewed for ${ago(late)}` : "";
  const lapsed = now > Date.parse(str(h.expires)) ? " · lapsed" : "";
  return { kind: "held", line: `GPU+RAM: ${what} · held ${held}${quiet}${lapsed}${free}`, holder: name, job, waiting };
}

/** What "Free it" will do to this holder, in words, for the confirm row. */
export function freeWords(band: Band): string {
  if (band.job) return `Stop ${band.holder}'s job and free it?`;
  return `Free it? ${band.holder} declared no job to stop: it stops its own work when it next renews (a batch finishes its round first).`;
}
