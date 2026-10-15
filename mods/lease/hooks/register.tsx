import type { EngineInterface, Register } from "claude-code";
import { atom, read, update } from "claude-code";
import type { Band } from "../types";
import { bandOf } from "./band";

const band = atom({ plugin: "lease", key: "band" } as const, null);

const EVERY_MS = 5_000; // one small file read: cheap, and a lease changes on the scale of seconds

async function folder($: EngineInterface): Promise<string> {
  const own = await $.env.get("LEASES_HOME");
  if (own) return own;
  const home = (await $.env.get("USERPROFILE")) ?? (await $.env.get("HOME")) ?? "";
  return `${home}/.leases`;
}

async function refresh($: EngineInterface): Promise<void> {
  const dir = await folder($);
  const text = await $.fs.read(`${dir}/state.json`).catch(() => null);
  const next = bandOf(text, await $.clock.now());
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
            <Text color={line.stuck === null ? "success" : "error"}>● </Text>
            <Text dimColor={line.stuck === null}>{line.text}</Text>
            {line.problem ? <Text color="error"> · {line.problem}</Text> : null}
          </Text>
        ))}
      </Box>
    );
  });
};
