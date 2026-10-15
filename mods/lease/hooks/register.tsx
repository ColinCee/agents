import type { EngineInterface, Register } from "claude-code";
import { atom, read, update } from "claude-code";
import type { Band } from "../types";
import { bandOf } from "./band";

const band = atom({ plugin: "lease", key: "band" } as const, null);

const TONE = { ok: "success", stuck: "error", unlocked: "warning" } as const;
const EVERY_MS = 5_000; // one small file read: cheap, and a lease changes on the scale of seconds
const STALE_MS = 30_000; // a holder renews every 30 s; older than that, nothing is renewing and the band measures itself

async function folder($: EngineInterface): Promise<string> {
  const own = await $.env.get("LEASES_HOME");
  if (own) return own;
  const home = (await $.env.get("USERPROFILE")) ?? (await $.env.get("HOME")) ?? "";
  return `${home}/.leases`;
}

let measuring = false;

async function refresh($: EngineInterface): Promise<void> {
  const dir = await folder($);
  const text = await $.fs.read(`${dir}/state.json`).catch(() => null);
  const now_ = await $.clock.now();
  // Nobody has run the command lately (nothing held): run it once, so GPU use without a lock and lapsed holders
  // are measured and tidied. The next refresh reads what it wrote.
  const measured = text === null ? Number.NaN : Date.parse(/"measured":\s*"([^"]+)"/.exec(text)?.[1] ?? "");
  if (text !== null && !measuring && !(now_ - measured < STALE_MS)) {
    measuring = true;
    void $.process
      .run(["node", `${dir}/lease.mjs`, "show"], { timeoutMs: 30_000 })
      .catch(() => null)
      .finally(() => {
        measuring = false;
      });
  }
  const next = bandOf(text, now_);
  const now = await read($, band);
  if (JSON.stringify(now) !== JSON.stringify(next)) await update($, band, () => next);
}

// Shows only: taking and freeing are the agents' and programs' work, through the lease command.
export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await refresh($);
    $.clock.every(EVERY_MS, () => refresh($));
    return next(e);
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const shown: Band | null = await read($, band);
    if (e.props.hasSurvey || shown === null) return next(e);
    const { Box, Text } = $.ui.resolve(e);
    if (shown.unreadable) return <Text color="error">lease: the state file cannot be read; run lease show</Text>;
    return (
      <Box flexDirection="column">
        {shown.lines.map((line) => (
          <Text key={line.key} wrap="truncate-end">
            <Text color={TONE[line.tone]}>● </Text>
            <Text dimColor={line.tone === "ok"}>{line.text}</Text>
            {line.problem ? <Text color={TONE[line.tone]}> · {line.problem}</Text> : null}
          </Text>
        ))}
      </Box>
    );
  });
};
