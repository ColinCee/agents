import type { EngineInterface, Register } from "claude-code";
import { atom, read, update } from "claude-code";
import type { Band } from "../types";
import { bandOf, freeWords } from "./band";

const band = atom({ plugin: "lease", key: "band" } as const, null);
const confirming = atom({ plugin: "lease", key: "confirming" } as const, false);
const said = atom({ plugin: "lease", key: "said" } as const, "");

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

// Only on his press: the lease command frees it under its lock, logs it, and stops the job the holder declared.
async function freeIt($: EngineInterface): Promise<void> {
  const dir = await folder($);
  const argv = [
    "node",
    `${dir}/lease.mjs`,
    "free",
    "--force",
    "--stop-job",
    "--by",
    "Colin (Claude Code)",
    "--cooldown",
    "600",
  ];
  const words = await $.process
    .run(argv, { timeoutMs: 90_000 })
    .then((r) => (r.exitCode === 0 ? r.stdout.trim() : `lease said: ${(r.stdout || r.stderr).trim()}`))
    .catch((error: unknown) => `could not run lease (${String(error)}); in a terminal: lease free --force --stop-job`);
  await update($, said, () => words);
  await refresh($);
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await refresh($);
    $.clock.every(EVERY_MS, () => refresh($));
    return next(e);
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const shown: Band | null = await read($, band);
    if (e.props.hasSurvey || shown === null) return next(e);
    const isAsking = await read($, confirming);
    const message = await read($, said);
    const { Box, Button, Text } = $.ui.resolve(e);
    const color = shown.kind === "free" ? "subtle" : shown.kind === "held" ? "warning" : "error";
    return (
      <Box flexDirection="column">
        <Box>
          <Text color={color} wrap="truncate-end">
            {shown.kind === "free" ? "" : "\u{1F512} "}
            {shown.line}
            {shown.waiting ? ` · waiting: ${shown.waiting}` : ""}{" "}
          </Text>
          {shown.kind === "held" || shown.kind === "orphaned" ? (
            <Button key="free" label="Free it" onPress={() => update($, confirming, () => true)} />
          ) : null}
        </Box>
        {isAsking && shown.holder ? (
          <Box>
            <Text>{freeWords(shown)} </Text>
            <Button
              key="yes"
              label="Yes, free it"
              variant="primary"
              onPress={async () => {
                await update($, confirming, () => false);
                await freeIt($);
              }}
            />
            <Button key="no" label="No" onPress={() => update($, confirming, () => false)} />
          </Box>
        ) : null}
        {message ? (
          <Box>
            <Text dimColor wrap="truncate-end">
              {message}{" "}
            </Text>
            <Button key="ok" label="OK" onPress={() => update($, said, () => "")} />
          </Box>
        ) : null}
      </Box>
    );
  });
};
