#!/usr/bin/env node
// List what the user typed in past coding-agent sessions, each with the end of the agent's reply before it.
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
const HELP = `List what the user typed in past coding-agent sessions, each with the end of the agent's reply before it.

  node prompts.mjs [ROOT ...] [--since YYYY-MM-DD | --session ID|PATH] [--context N] [--limit N] [--json]

ROOT        folders of session transcripts (.jsonl). Default: ~/.claude/projects and ~/.codex/sessions,
            where they exist.
--since     only prompts on or after this date (default: 14 days ago)
--session   only this one session: its id (the transcript's file name) or the path of its .jsonl; all dates
--context   characters of the agent's reply kept before each prompt (default 200)
--limit     the most prompts printed (default 3000); the rest are counted
--json      one JSON object per line in place of text

Reads only; writes nothing. Anything that looks like a key or token is replaced with [secret removed],
so it cannot be copied on into a report.
Exit codes: 0 done, 1 no transcripts found, 2 bad arguments.`;
const DEFAULT_DAYS = 14; // two weeks: long enough for a correction to come back, short enough to read in one pass
const DEFAULT_CONTEXT = 200; // enough of the agent's last reply to see what was being corrected
const DEFAULT_LIMIT = 3000; // about two weeks of heavy use; more is cut with a count
const PROMPT_CHARS = 600; // long pastes are cut; the start says what was asked
export const SECRETS = new RegExp([
    String.raw `gh[pousr]_[A-Za-z0-9]{20,}`,
    String.raw `github_pat_[A-Za-z0-9_]{20,}`,
    String.raw `sk-[A-Za-z0-9_-]{20,}`,
    String.raw `xox[abprs]-[A-Za-z0-9-]{10,}`,
    String.raw `AKIA[0-9A-Z]{16}`,
    String.raw `AIza[0-9A-Za-z_-]{30,}`,
    String.raw `-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----`,
    String.raw `\b[A-Za-z0-9+/_-]{40,}\b`,
].join("|"), "g");
export function clean(text) {
    return text
        .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
        .replace(SECRETS, "[secret removed]")
        .replace(/\s+/g, " ")
        .trim();
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
/** Each message in one transcript, in Claude Code's or Codex's format. */
function* turns(path) {
    for (const line of readFileSync(path, "utf8").split("\n")) {
        let e;
        try {
            e = JSON.parse(line);
        }
        catch {
            continue;
        }
        // isMeta: text the agent harness added in the user's place, such as a loaded skill
        if (typeof e !== "object" || e === null || e.isSidechain || e.isMeta)
            continue;
        const payload = (typeof e.payload === "object" && e.payload !== null ? e.payload : {});
        let role;
        let content;
        if (e.type === "user" || e.type === "assistant") {
            role = e.type;
            content = e.message?.content;
            const isToolResult = Array.isArray(content) && content.some((p) => typeof p === "object" && p !== null && p.type === "tool_result");
            if (role === "user" && isToolResult)
                continue;
        }
        else if (payload.type === "message" && (payload.role === "user" || payload.role === "assistant")) {
            role = payload.role;
            content = payload.content;
        }
        else
            continue;
        const text = textOf(content);
        if (text.trim())
            yield {
                role: role,
                ts: String(e.timestamp ?? ""),
                cwd: String(e.cwd ?? payload.cwd ?? ""),
                text,
            };
    }
}
export function jsonlFiles(root) {
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
export function defaultRoots() {
    const roots = [join(homedir(), ".claude", "projects"), join(homedir(), ".codex", "sessions")];
    return roots.filter((p) => statSync(p, { throwIfNoEntry: false })?.isDirectory());
}
/** The transcript for --session: a path to a .jsonl, or an id looked up as <id>.jsonl under the roots. */
export function findSession(session, roots) {
    if (session.endsWith(".jsonl"))
        return statSync(session, { throwIfNoEntry: false })?.isFile() ? session : undefined;
    return roots.flatMap(jsonlFiles).find((f) => basename(f, ".jsonl") === session);
}
function main() {
    let args;
    try {
        args = parseArgs({
            allowPositionals: true,
            options: {
                since: { type: "string" },
                session: { type: "string" },
                context: { type: "string", default: String(DEFAULT_CONTEXT) },
                limit: { type: "string", default: String(DEFAULT_LIMIT) },
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
    const sinceArg = args.values.since;
    if (sinceArg !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(sinceArg)) {
        console.error(`--since ${JSON.stringify(sinceArg)} is not a date like 2026-10-01`);
        return 2;
    }
    const session = args.values.session;
    const since = session
        ? ""
        : (sinceArg ?? new Date(Date.now() - DEFAULT_DAYS * 86_400_000).toISOString().slice(0, 10));
    const context = Number(args.values.context);
    const limit = Number(args.values.limit);
    const roots = args.positionals.length ? args.positionals : defaultRoots();
    const one = session ? findSession(session, roots) : undefined;
    if (session && !one) {
        console.error(`No transcript for --session ${session} under ${roots.join(", ")}. Pass the .jsonl path instead.`);
        return 1;
    }
    const files = one ? [one] : roots.flatMap(jsonlFiles).sort();
    if (!files.length) {
        console.error(`No .jsonl transcripts under ${roots.join(", ") || "the default folders"}. Pass the folder your agent keeps sessions in.`);
        return 1;
    }
    const rows = [];
    for (const file of files) {
        let before = "";
        for (const t of turns(file)) {
            if (t.role === "assistant") {
                before = t.text;
                continue;
            }
            if (t.text.trimStart().startsWith("<") || t.ts.slice(0, 10) < since)
                continue;
            const prompt = clean(t.text);
            if (!prompt)
                continue;
            rows.push({
                session: basename(file, ".jsonl"),
                project: t.cwd ? basename(t.cwd) : basename(dirname(file)),
                date: t.ts.slice(0, 10),
                prompt: prompt.slice(0, PROMPT_CHARS),
                before: context ? clean(before).slice(-context) : "",
            });
        }
    }
    rows.sort((a, b) => (a.date + a.session).localeCompare(b.date + b.session));
    const sessions = new Set(rows.map((r) => r.session)).size;
    const projects = new Set(rows.map((r) => r.project)).size;
    console.error(`${rows.length} prompts in ${sessions} sessions, ${projects} projects, ${session ? `in session ${session}` : `since ${since}`}`);
    for (const r of rows.slice(0, limit)) {
        console.log(args.values.json
            ? JSON.stringify(r)
            : `${r.date} ${r.project}/${r.session} | ${r.prompt}${r.before ? `  || before: ${r.before}` : ""}`);
    }
    if (rows.length > limit)
        console.error(`... ${rows.length - limit} more not shown; narrow --since or raise --limit`);
    return 0;
}
// Run only when called, not when edits.mjs imports the helpers above.
if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url)))
    process.exitCode = main();
