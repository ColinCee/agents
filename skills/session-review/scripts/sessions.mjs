#!/usr/bin/env node
// List what the user corrected in the coding-agent sessions that ended on one day: what they typed, and what they
// changed by hand in the files those sessions wrote.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
const HELP = `List what the user corrected in the coding-agent sessions that ended on one day.

  node sessions.mjs [ROOT ...] [--day YYYY-MM-DD] [--json]

ROOT    folders of session transcripts (.jsonl). Default: ~/.claude/projects and ~/.codex/sessions, where they exist.
--day   the day, in local time, whose sessions to list: those whose last message was that day (default: yesterday).
        A session still in use is listed on the day it goes quiet, so each is listed once.
--json  one JSON object per line in place of text

For each session: every prompt the user typed, with the end of the agent's reply before it; then the user's hand
edits to files the session wrote. A hand edit is a difference between the agent's version after its write and
what came next: the file as the next agent write found it (in any session), or the file on disk now. Changes with
a command run in between that names the file or rewrites files (a script, a formatter, git) list those commands.
Hand edits need Claude Code transcripts and git, for its word diff.
Reads only; writes nothing but a temporary folder it removes.
Exit codes: 0 done, 1 no transcripts found, 2 bad arguments.`;
const CONTEXT = 200; // enough of the agent's last reply to see what was being corrected
const PROMPT_CHARS = 600; // long pastes are cut; the start says what was asked
const PROMPT_LIMIT = 1500; // a heavy day is a few hundred prompts; more is cut with a count
const EDIT_LIMIT = 60; // a few sessions' worth of hand edits; past that the diffs are noise
const DIFF_CHARS = 5000; // enough of a diff to see the pattern of a rewrite; past that it is one rewrite
const MIN_PIECE = 3; // shorter changed text (a quote, "an") is found in almost any script by chance
const MIN_LINE = 8; // a shorter line a command wrote ("}", "</Fig>") matches anything
const NEAR = 0.4; // share of words two lines need to be one line reworded: "a game, under 1¢" vs "1 game, < $0.01"
const COMMAND_CHARS = 100; // enough to see what a command was; the rest is its script
const COMMANDS_SHOWN = 3; // a few say whether the agent was editing the file; the count says the rest
const MAX_FILE_BYTES = 1_000_000; // larger files are data or builds, not text the user rewrites
// Commands that change files without an Edit: their runs between a write and the next look are named.
const FILE_CHANGERS = /\b(biome|prettier|eslint|ruff|black|gofmt|rustfmt|sed|perl|git (checkout|restore|merge|rebase|pull|stash|reset|apply|cherry-pick))\b/;
const pad = (n) => String(n).padStart(2, "0");
const dayOf = (time) => {
    const d = new Date(time);
    return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const keyOf = (path) => {
    const full = resolve(path);
    return process.platform === "win32" || process.platform === "darwin" ? full.toLowerCase() : full;
};
const lf = (text) => text.replace(/\r\n/g, "\n");
const clean = (text) => text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/\s+/g, " ")
    .trim();
function jsonlFiles(root) {
    const out = [];
    const walk = (dir) => {
        let names;
        try {
            names = readdirSync(dir);
        }
        catch {
            return;
        }
        for (const name of names) {
            const path = join(dir, name);
            try {
                if (statSync(path).isDirectory())
                    walk(path);
                else if (name.endsWith(".jsonl"))
                    out.push(path);
            }
            catch {
                // gone since the listing: skip it
            }
        }
    };
    walk(root);
    return out;
}
/** Every entry of a transcript; with mustHave, only lines containing one of those strings. */
function entries(path, mustHave) {
    let text;
    try {
        text = readFileSync(path, "utf8");
    }
    catch {
        return [];
    }
    if (mustHave && !mustHave.some((s) => text.includes(s)))
        return [];
    const out = [];
    for (const line of text.split("\n")) {
        if (mustHave && !mustHave.some((s) => line.includes(s)))
            continue;
        try {
            const e = JSON.parse(line);
            if (typeof e === "object" && e !== null)
                out.push(e);
        }
        catch {
            // a line cut off while the session was writing it
        }
    }
    return out;
}
function textOf(content) {
    if (typeof content === "string")
        return content;
    if (!Array.isArray(content))
        return "";
    return content
        .filter((p) => typeof p === "object" && p !== null)
        .filter((p) => ["text", "input_text", "output_text"].includes(p.type))
        .map((p) => p.text ?? "")
        .join(" ");
}
/** What the user typed in one transcript, in Claude Code's or Codex's format, each with the reply before it. */
function prompts(session, list) {
    const out = [];
    let before = "";
    for (const e of list) {
        // isSidechain: a subagent's, prompted by the agent; isMeta: text the harness added in the user's place
        if (e.isSidechain || e.isMeta)
            continue;
        const payload = (typeof e.payload === "object" && e.payload !== null ? e.payload : {});
        let role;
        let content;
        if (e.type === "user" || e.type === "assistant") {
            role = e.type;
            content = e.message?.content;
            if (Array.isArray(content) && content.some((p) => p?.type === "tool_result"))
                continue;
        }
        else if (payload.type === "message") {
            role = payload.role;
            content = payload.content;
        }
        else
            continue;
        const text = textOf(content);
        if (!text.trim())
            continue;
        if (role === "assistant") {
            before = text;
            continue;
        }
        if (role !== "user" || text.trimStart().startsWith("<"))
            continue;
        const prompt = clean(text);
        const cwd = String(e.cwd ?? payload.cwd ?? "");
        if (prompt)
            out.push({
                type: "prompt",
                session,
                project: cwd ? basename(cwd) : "",
                prompt: prompt.slice(0, PROMPT_CHARS),
                before: clean(before).slice(-CONTEXT),
            });
    }
    return out;
}
function replaceOnce(text, from, to, all) {
    if (all)
        return text.split(from).join(to);
    const at = text.indexOf(from);
    return at < 0 ? null : text.slice(0, at) + to + text.slice(at + from.length);
}
/** The file state before and after one Write or Edit result, from Claude Code's toolUseResult. */
function writeOf(e, previous) {
    const r = e.toolUseResult;
    if (typeof r !== "object" || r === null || Array.isArray(r) || typeof r.filePath !== "string")
        return null;
    const before = typeof r.originalFile === "string" ? lf(r.originalFile) : previous;
    if (typeof r.content === "string" && (r.type === "create" || r.type === "update"))
        return { path: r.filePath, before, after: lf(r.content) };
    const edits = Array.isArray(r.edits)
        ? r.edits
        : typeof r.oldString === "string"
            ? [{ old_string: r.oldString, new_string: r.newString, replace_all: r.replaceAll }]
            : null;
    if (!edits)
        return null;
    let after = before;
    for (const edit of edits) {
        if (after === null)
            break;
        after = replaceOnce(after, lf(String(edit.old_string)), lf(String(edit.new_string ?? "")), Boolean(edit.replace_all));
    }
    return { path: r.filePath, before, after };
}
function toolUses(e) {
    const content = e.message?.content;
    return Array.isArray(content) ? content.filter((p) => p?.type === "tool_use") : [];
}
/** One session's writes, the skills it loaded, the commands it ran, and edits the user changed before accepting. */
function sessionWrites(session, list) {
    const writes = [];
    const skills = new Set();
    const commands = [];
    const accepted = [];
    const proposed = new Map();
    const last = new Map();
    for (const e of list) {
        const ts = String(e.timestamp ?? "");
        for (const use of toolUses(e)) {
            const input = (use.input ?? {});
            proposed.set(String(use.id), input);
            if (use.name === "Skill" && typeof input.skill === "string")
                skills.add(input.skill);
            const read = typeof input.file_path === "string" ? /[\\/]skills[\\/]([^\\/]+)[\\/]SKILL\.md$/i.exec(input.file_path) : null;
            if (read?.[1])
                skills.add(read[1]);
            if (typeof input.command === "string")
                commands.push({ ts, session, command: input.command });
        }
        const w = writeOf(e, null);
        if (!w)
            continue;
        const file = keyOf(w.path);
        if (w.before === null && last.has(file))
            w.before = last.get(file) ?? null;
        if (w.after === null && w.before !== null)
            w.after = writeOf(e, w.before)?.after ?? null;
        last.set(file, w.after);
        writes.push({ ...w, file, session, ts });
        const r = e.toolUseResult;
        const content = e.message?.content;
        const useId = Array.isArray(content) ? content.find((p) => p?.type === "tool_result")?.tool_use_id : undefined;
        const asked = proposed.get(String(useId));
        const askedText = asked?.new_string ?? asked?.content;
        const gotText = r.newString ?? r.content;
        if (r.userModified === true && typeof askedText === "string" && typeof gotText === "string")
            accepted.push({
                type: "edit",
                session,
                file: w.path,
                written: ts,
                against: "the edit as the user accepted it",
                skills: [],
                commands: [],
                diff: `${lf(askedText)}\0${lf(gotText)}`,
                blob: "",
            });
    }
    return { writes, skills, commands, accepted };
}
const flat = (text) => text
    .replace(/\\[nt]/g, " ")
    .replace(/\\(["'`$])/g, "$1")
    .replace(/\s+/g, " ");
const words = (text) => new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
/** The line a command wrote that shares the most words with this one, when it is close but not the same. */
function nearest(line, written) {
    const mine = words(line);
    let best;
    let score = NEAR;
    for (const w of written) {
        if (w === line.trim())
            return undefined;
        const theirs = words(w);
        const shared = [...mine].filter((x) => theirs.has(x)).length;
        const s = shared / (mine.size + theirs.size - shared || 1);
        if (s >= score)
            [best, score] = [w, s];
    }
    return best;
}
/**
 * Drop changed lines whose every changed piece of text is in a command run in between: an agent's sed or script
 * wrote them. Pieces shorter than MIN_PIECE (a quote, a full stop) prove nothing either way.
 */
function hand(diff, blob) {
    if (!blob)
        return { kept: diff, dropped: 0 };
    const all = flat(blob);
    const written = blob
        .split(/\n|\\n/)
        .map((l) => flat(l).trim())
        .filter((l) => l.length >= MIN_LINE);
    let dropped = 0;
    const lines = diff.split("\n").flatMap((line) => {
        const pieces = [...line.matchAll(/\[-(.*?)-\]|\{\+(.*?)\+\}/g)].map((m) => flat(m[1] ?? m[2] ?? "").trim());
        const long = pieces.filter((p) => p.length >= MIN_PIECE);
        if (long.length > 0 && long.every((p) => all.includes(p))) {
            dropped++;
            return [];
        }
        // A whole new line may replace one a command wrote, which the agent's version from its edits never had.
        const added = /^\{\+(.*)\+\}$/.exec(line.trim())?.[1];
        const near = added ? nearest(flat(added), written) : undefined;
        return near ? [line, `    (a command had written: ${near.slice(0, COMMAND_CHARS)})`] : [line];
    });
    // A hunk left with no change in it is only context.
    const hunks = lines
        .join("\n")
        .split(/(?=^@@)/m)
        .filter((h) => /\[-|\{\+/.test(h));
    return { kept: hunks.join("").trim(), dropped };
}
function wordDiff(dir, a, b, blob) {
    writeFileSync(join(dir, "agent"), a);
    writeFileSync(join(dir, "later"), b);
    const done = spawnSync("git", ["diff", "--no-index", "--no-color", "--word-diff=plain", "--unified=1", "--", "agent", "later"], { cwd: dir, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
    if (done.error)
        throw new Error(`git did not run (${done.error.message}); hand edits need git on PATH`);
    const body = done.stdout.slice(Math.max(0, done.stdout.indexOf("@@")));
    const { kept, dropped } = hand(body, blob);
    if (!kept)
        return "";
    const text = `${kept}${dropped ? `\n(${dropped} changed lines left out: the same text is in a command run in between)` : ""}`;
    return text.length > DIFF_CHARS
        ? `${text.slice(0, DIFF_CHARS)}\n... ${text.length - DIFF_CHARS} more characters`
        : text;
}
/** The user's hand edits to files these sessions wrote, found against every later write and the disk now. */
function handEdits(picked, all) {
    const writes = [];
    const commands = [];
    const skills = new Map();
    const edits = [];
    const scratch = keyOf(tmpdir());
    for (const { session, list } of picked) {
        const s = sessionWrites(session, list);
        // Not the agent's own scratch files in the temp folder: the user never edits those, but its scripts do.
        writes.push(...s.writes.filter((w) => !w.file.startsWith(scratch)));
        commands.push(...s.commands);
        edits.push(...s.accepted);
        skills.set(session, [...s.skills]);
    }
    if (!writes.length)
        return { edits, skills };
    // A session continued in a second transcript repeats the first one's entries.
    const unique = [...new Map(writes.map((w) => [`${w.file}|${w.ts}`, w])).values()];
    let unbuilt = 0;
    // Every write to the same files from then on, in any transcript (subagents' too): its "before" is what the user
    // left there. File names, not paths: a command names a file relative to where it runs.
    const files = new Set(writes.map((w) => w.file));
    const first = writes.map((w) => w.ts).sort()[0] ?? "";
    const needles = [...new Set(writes.map((w) => basename(w.path)))];
    const timeline = [];
    const seen = new Set(commands.map((c) => c.ts + c.command));
    for (const path of all) {
        if ((statSync(path, { throwIfNoEntry: false })?.mtime.toISOString() ?? "") < first)
            continue;
        for (const e of entries(path, needles)) {
            const ts = String(e.timestamp ?? "");
            if (ts <= first)
                continue;
            const session = String(e.sessionId ?? basename(path, ".jsonl"));
            for (const use of toolUses(e)) {
                const command = use.input?.command;
                if (typeof command === "string" && needles.some((n) => command.includes(n)) && !seen.has(ts + command)) {
                    seen.add(ts + command);
                    commands.push({ ts, session, command });
                }
            }
            const w = writeOf(e, null);
            if (w && files.has(keyOf(w.path)))
                timeline.push({ ...w, file: keyOf(w.path), session, ts });
        }
    }
    timeline.sort((a, b) => a.ts.localeCompare(b.ts));
    for (const w of unique) {
        if (w.after === null) {
            unbuilt++;
            continue;
        }
        const next = timeline.find((n) => n.file === w.file && n.ts > w.ts);
        let now;
        let against;
        if (next) {
            if (next.before === null)
                continue;
            now = next.before;
            against =
                next.session === w.session
                    ? `the file at this session's next write (${next.ts})`
                    : `the file when session ${next.session} next wrote it (${next.ts})`;
        }
        else {
            const size = statSync(w.path, { throwIfNoEntry: false })?.size;
            if (size === undefined || size > MAX_FILE_BYTES)
                continue; // deleted, or not text the user rewrites
            now = lf(readFileSync(w.path, "utf8"));
            against = "the file now";
        }
        if (now === w.after)
            continue;
        const end = next?.ts ?? "￿";
        const name = basename(w.path);
        const between = commands
            .filter((c) => c.ts > w.ts && c.ts < end)
            .filter((c) => c.command.includes(name) || (c.session === w.session && FILE_CHANGERS.test(c.command)));
        edits.push({
            type: "edit",
            session: w.session,
            file: w.path,
            written: w.ts,
            against,
            skills: skills.get(w.session) ?? [],
            commands: between.map((c) => `${c.session === w.session ? "" : `(session ${c.session.slice(0, 8)}) `}${c.command.replace(/\s+/g, " ").slice(0, COMMAND_CHARS)}`),
            diff: `${w.after}\0${now}`,
            blob: between.map((c) => c.command).join("\n"),
        });
    }
    if (unbuilt)
        console.error(`${unbuilt} agent writes skipped: their text could not be rebuilt from the transcript`);
    const dir = mkdtempSync(join(tmpdir(), "session-review-"));
    try {
        for (const c of edits) {
            c.skills = skills.get(c.session) ?? [];
            const [a = "", b = ""] = c.diff.split("\0");
            c.diff = wordDiff(dir, a, b, c.blob);
        }
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
    // Changes nothing else could have made come first: they are the user's for certain.
    const shown = edits.filter((c) => c.diff);
    return { edits: shown.sort((a, b) => Number(a.commands.length > 0) - Number(b.commands.length > 0)), skills };
}
function main() {
    let args;
    try {
        args = parseArgs({
            allowPositionals: true,
            options: {
                day: { type: "string" },
                json: { type: "boolean", default: false },
                help: { type: "boolean", short: "h", default: false },
            },
        });
    }
    catch (e) {
        console.error(`${e.message}\n\n${HELP}`);
        return 2;
    }
    if (args.values.help) {
        console.log(HELP);
        return 0;
    }
    const day = args.values.day ?? dayOf(Date.now() - 86_400_000);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        console.error(`--day ${JSON.stringify(day)} is not a date like 2026-10-01`);
        return 2;
    }
    const json = Boolean(args.values.json);
    const roots = args.positionals.length
        ? args.positionals
        : [join(homedir(), ".claude", "projects"), join(homedir(), ".codex", "sessions")].filter((p) => statSync(p, { throwIfNoEntry: false })?.isDirectory());
    const all = roots.flatMap(jsonlFiles).sort();
    if (!all.length) {
        console.error(`No .jsonl transcripts under ${roots.join(", ") || "the default folders"}. Pass the folder your agent keeps sessions in.`);
        return 1;
    }
    // A session that went quiet on the day was last written that day or later; read only those.
    const start = new Date(`${day}T00:00:00`).toISOString();
    const picked = [];
    for (const path of all) {
        // A subagent's transcript is part of its parent's session, prompted by the agent, not the user.
        if (dirname(path).split(sep).includes("subagents"))
            continue;
        if ((statSync(path, { throwIfNoEntry: false })?.mtime.toISOString() ?? "") < start)
            continue;
        const list = entries(path);
        const last = list.reduce((m, e) => (typeof e.timestamp === "string" && e.timestamp > m ? e.timestamp : m), "");
        if (dayOf(last) === day)
            picked.push({ session: String(list.find((e) => e.sessionId)?.sessionId ?? basename(path, ".jsonl")), list });
    }
    const typed = picked.flatMap((p) => prompts(p.session, p.list));
    const { edits, skills } = handEdits(picked, all);
    const bySession = new Map();
    for (const p of picked)
        bySession.set(p.session, { prompts: [], edits: [] });
    for (const p of typed)
        bySession.get(p.session)?.prompts.push(p);
    for (const e of edits)
        bySession.get(e.session)?.edits.push(e);
    console.error(`${picked.length} sessions went quiet on ${day}: ${typed.length} prompts, ${edits.length} hand edits`);
    let promptsLeft = PROMPT_LIMIT;
    let editsLeft = EDIT_LIMIT;
    for (const [session, s] of bySession) {
        if (!s.prompts.length && !s.edits.length)
            continue;
        const shownPrompts = s.prompts.slice(0, Math.max(0, promptsLeft));
        const shownEdits = s.edits.slice(0, Math.max(0, editsLeft));
        promptsLeft -= shownPrompts.length;
        editsLeft -= shownEdits.length;
        if (json) {
            for (const p of shownPrompts)
                console.log(JSON.stringify(p));
            for (const { blob: _, ...e } of shownEdits)
                console.log(JSON.stringify(e));
            continue;
        }
        const project = s.prompts.find((p) => p.project)?.project ?? "";
        const used = skills.get(session) ?? [];
        console.log(`\n# ${project ? `${project}/` : ""}${session}${used.length ? ` (skills: ${used.join(", ")})` : ""}`);
        for (const p of shownPrompts)
            console.log(`- ${p.prompt}${p.before ? `  || before: ${p.before}` : ""}`);
        for (const e of shownEdits) {
            console.log(`\n## hand edit: ${e.file}\nagent wrote it ${e.written}; compared with ${e.against}`);
            if (e.commands.length)
                console.log(`${e.commands.length} commands in between may have changed it, so some of this may be an agent's: ${e.commands.slice(0, COMMANDS_SHOWN).join(" | ")}`);
            console.log(e.diff);
        }
    }
    if (typed.length > PROMPT_LIMIT)
        console.error(`... ${typed.length - PROMPT_LIMIT} more prompts not shown`);
    if (edits.length > EDIT_LIMIT)
        console.error(`... ${edits.length - EDIT_LIMIT} more hand edits not shown`);
    return 0;
}
process.exitCode = main();
