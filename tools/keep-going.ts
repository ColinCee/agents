// Measures the keep-going reminder (mods/keep-going) against one baseline, agents with no AGENTS.md rule, from stops
// labelled by what the user typed next, and draws it as one chart. Data stays in ~/.claude/keep-going, never in this
// repository: it is the user's own sessions.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HELP = "Labels come from ~/.claude/keep-going/labelling (its README).";
const DATA = join(homedir(), ".claude", "keep-going");

type Label = { key: string; day: string; cat: string; verdict: string; why: string };

const jsonl = <T>(path: string): T[] =>
  readFileSync(path, "utf8")
    .replace(/^﻿/, "")
    .split("\n")
    .flatMap((l) => {
      try {
        return l.trim() ? [JSON.parse(l) as T] : [];
      } catch {
        return []; // a line cut off while it was written
      }
    });

/** One bar: a setup measured on labelled stops. */
type Row = { name: string; stops: number; needlessPer100: number }; // needless: the user had to nudge
const round1 = (x: number) => Math.round(x * 10) / 10;

const MIN_STOPS = 50; // below this one nudge moves the rate by 2 per 100 or more, more than the effects measured

/** One chart: each setup's needless stops per 100, as a change from no rule; the stop count is in the tooltip. */
function chartPage(base: Row, rows: Row[]): string {
  const collecting = rows.filter((r) => r.stops < MIN_STOPS).map((r) => r.name);
  const bars = rows
    .filter((r) => r.stops >= MIN_STOPS)
    .map((r) => ({ label: r.name, change: round1(r.needlessPer100 - base.needlessPer100), stops: r.stops }));
  const height = 110 + 44 * bars.length; // one 22 px bar per row plus its gap, and room for the axis and its title
  return `<!doctype html><meta charset="utf-8"><title>Keep going</title>
<style>body{font:14px system-ui,sans-serif;margin:24px;max-width:760px;color:#0b0b0b;background:#fcfcfb}
h1{font-size:16px;font-weight:500;margin:0 0 12px}p{color:#52514e;margin:12px 0 0;font-size:13px}
@media (prefers-color-scheme:dark){body{color:#f0efec;background:#1a1a19}p{color:#c3c2b7}}</style>
<h1>Needless stops, vs no AGENTS.md rule (${base.needlessPer100} per 100)</h1>
<div style="position:relative;height:${height}px"><canvas id="d"></canvas></div>
${collecting.length ? `<p>Waiting for ${MIN_STOPS} stops: ${collecting.join(", ")}</p>` : ""}
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script>
const rows=${JSON.stringify(bars)};const dark=matchMedia('(prefers-color-scheme: dark)').matches;
const ink=dark?'#c3c2b7':'#52514e',muted='#898781',grid=dark?'#2c2c2a':'#e1e0d9',blue=dark?'#3987e5':'#2a78d6',red=dark?'#e66767':'#e34948';
const span=Math.ceil((Math.max(5,...rows.map(r=>Math.abs(r.change)))+1)/5)*5;
const fmt=v=>(v>0?'+':'')+v;
new Chart(document.getElementById('d'),{type:'bar',data:{labels:rows.map(r=>r.label),datasets:[
 {data:rows.map(r=>r.change),backgroundColor:rows.map(r=>r.change<=0?blue:red),borderRadius:4,barThickness:22}]},
 options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,layout:{padding:{right:56}},
  plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmt(c.raw)+' per 100, '+rows[c.dataIndex].stops+' stops'}}},
  scales:{x:{min:-span,max:span,title:{display:true,text:'change in needless stops per 100 (left is better)',color:ink},
    grid:{color:c=>c.tick.value===0?muted:grid,lineWidth:c=>c.tick.value===0?2:1},ticks:{color:ink,callback:fmt}},
   y:{grid:{display:false},ticks:{color:ink,font:{size:13}}}}},
 plugins:[{id:'value',afterDatasetsDraw(c){const x=c.ctx;x.fillStyle=ink;x.font='500 12px system-ui';
  c.getDatasetMeta(0).data.forEach((b,i)=>x.fillText(fmt(rows[i].change),Math.max(b.x,c.scales.x.getPixelForValue(0))+8,b.y+4))}}]});
</script>`;
}

/** Every setup against no rule, from the labelled stops, and how many reminders the hook gave. */
function main(): number {
  const labelDir = join(DATA, "labels");
  const judged = (existsSync(labelDir) ? readdirSync(labelDir) : [])
    .flatMap((f) => jsonl<Label>(join(labelDir, f)))
    .filter((l) => ["right", "wrong"].includes(l.verdict));
  if (!judged.length) {
    console.error(`No labelled stops in ${labelDir}. ${HELP}`);
    return 1;
  }
  const row = (name: string, part: Label[]): Row => ({
    name,
    stops: part.length,
    needlessPer100: round1((100 * part.filter((l) => l.verdict === "wrong").length) / (part.length || 1)),
  });
  // Claude Code began loading the user-level rules on 16 Oct 2026. The reworded rule and the reminder went in on 27 Oct
  // and are read when a session starts, so their stops count from 28 Oct.
  const base = row(
    "No rule",
    judged.filter((l) => l.day < "2026-10-16"),
  );
  const rows = [
    row(
      "AGENTS.md rule",
      judged.filter((l) => l.day >= "2026-10-16" && l.day < "2026-10-27"),
    ),
    row(
      "Reworded rule + reminder",
      judged.filter((l) => l.day >= "2026-10-28"),
    ),
  ];
  for (const r of [base, ...rows]) console.log(`${r.name}: ${r.stops} stops, ${r.needlessPer100} needless per 100`);
  // What the reminder costs: one extra agent turn each, over the session's cached conversation.
  const logDir = join(DATA, "log");
  const days = existsSync(logDir) ? readdirSync(logDir) : [];
  const reminders = days.reduce(
    (n, d) => n + readdirSync(join(logDir, d)).flatMap((f) => jsonl(join(logDir, d, f))).length,
    0,
  );
  if (days.length) console.log(`Reminders: ${Math.round(reminders / days.length)} a day, one extra agent turn each`);
  const page = join(DATA, "results.html");
  writeFileSync(page, chartPage(base, rows));
  console.log(`\nChart: ${page}`);
  return 0;
}

process.exitCode = main();
