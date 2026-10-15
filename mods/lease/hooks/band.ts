import type { Band, Chip, Spare, Stuck } from "../types";

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
const NAME_MAX = 14; // a chip's title; the card has the whole name

const legacy = (gb: number): Want[] => [
  { resource: "gpu", gb: null },
  { resource: "ram", gb },
];

function wantsOf(v: Json | undefined, gb: Json | undefined): Want[] {
  if (!Array.isArray(v)) return legacy(num(gb) ?? 0);
  return objs(v).map((w) => ({ resource: str(w.resource), gb: num(w.gb) }));
}

const wantWords = (wants: Want[]) => wants.map((w) => (w.gb === null ? w.resource : `${w.resource}:${w.gb}`)).join(" ");
const short = (text: string) => (text.length > NAME_MAX ? `${text.slice(0, NAME_MAX - 1)}…` : text);
const labelOf = (resource: string, labels: Map<string, string>) =>
  labels.get(resource) ?? resource.replace(/-/g, "").slice(0, 3).toUpperCase();

export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 90 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** The band for the state file's text at `now`, or null when there is nothing to show. */
export function bandOf(text: string | null, now: number): Band | null {
  if (text === null) return null;
  let raw: Json;
  try {
    raw = JSON.parse(text) as Json;
  } catch {
    return { chips: [], spare: [], freeGb: null, unreadable: true };
  }
  if (!isObj(raw)) return null;
  const labels = new Map(objs(raw.resources).map((r) => [str(r.name), str(r.label)]));
  const holds = raw.version === 1 ? (isObj(raw.holder) ? [raw.holder] : []) : objs(raw.holds);
  const waiters = objs(raw.waiting).map((w) => ({ name: str(w.name), wants: wantsOf(w.wants, w.gb) }));
  const chips: Chip[] = holds.flatMap((h) => {
    const wants = wantsOf(h.wants, h.gb);
    const renewed = Date.parse(str(h.renewed));
    const until = h.until === undefined || h.until === null ? null : Date.parse(str(h.until));
    const stuck: Stuck =
      typeof h.orphaned === "string"
        ? "orphaned"
        : now - renewed > LATE_MS
          ? "late"
          : until !== null && now > until
            ? "over"
            : null;
    const name = str(h.name);
    const pid = num(h.pid) ?? 0;
    return wants.map((w) => ({
      key: `${w.resource}/${name}/${pid}`,
      label: w.gb === null ? labelOf(w.resource, labels) : `${labelOf(w.resource, labels)} · ${Math.round(w.gb)} GB`,
      holder: short(str(h.note) || name),
      stuck,
      waiting: waiters.filter((x) => x.wants.some((y) => y.resource === w.resource)).map((x) => x.name),
      name,
      pid,
      note: str(h.note),
      wants: wantWords(wants),
      job: isObj(h.job),
      taken: Date.parse(str(h.taken)),
      renewed,
      until,
    }));
  });
  // Stuck first, then the oldest: chips keep their places as others come and go.
  chips.sort((a, b) => Number(b.stuck !== null) - Number(a.stuck !== null) || a.taken - b.taken);
  const used = new Set(chips.map((c) => c.key.split("/")[0]));
  const spare: Spare[] = [...labels.keys()]
    .filter((r) => !used.has(r))
    .map((r) => ({ key: r, label: labelOf(r, labels) }));
  const waited = waiters.length > 0;
  if (chips.length === 0 && !waited) return null; // nothing held and nobody waiting: no band at all
  const freeGb = num(raw.free_gb);
  const fresh = now - Date.parse(str(raw.measured)) < FRESH_MS;
  return { chips, spare, freeGb: freeGb !== null && fresh ? freeGb : null, unreadable: false };
}

const STUCK_WORDS: Record<Exclude<Stuck, null>, string> = {
  orphaned: "Stuck: its holder is gone and its job still runs.",
  late: "Stuck: it has not checked in for over a minute; it frees itself at two.",
  over: "Stuck: it is past the time it said it would take.",
};

/** The card a click on a chip opens: who, how long, how it is doing, who waits. */
export function cardLines(chip: Chip, band: Band, now: number): string[] {
  const who = chip.note === "" ? `${chip.name} (pid ${chip.pid})` : `${chip.note} (${chip.name}, pid ${chip.pid})`;
  const lines = [`${who} holds ${chip.wants}`];
  const due = chip.until === null ? "" : chip.until > now ? ` · done in ${ago(chip.until - now)}` : "";
  lines.push(`held ${ago(now - chip.taken)} · checked in ${ago(now - chip.renewed)} ago${due}`);
  if (chip.stuck !== null) lines.push(STUCK_WORDS[chip.stuck]);
  if (chip.waiting.length > 0) lines.push(`waiting: ${chip.waiting.join(", ")}`);
  if (chip.key.startsWith("ram/") && band.freeGb !== null) lines.push(`${Math.round(band.freeGb)} GB of RAM free`);
  return lines;
}

/** What "Free it" will do, in words, for the confirm row. */
export function freeWords(chip: Chip): string {
  const who = chip.note || chip.name;
  if (chip.job) return `Stop ${who} and free ${chip.wants}?`;
  return `Free ${chip.wants}? ${who} stops its own work when it next checks in.`;
}
