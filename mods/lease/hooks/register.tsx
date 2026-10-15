import type { EngineInterface, Register } from "claude-code";
import { atom, read, update } from "claude-code";
import type { Band, Chip } from "../types";
import { bandOf, cardLines, freeWords, hoverLine } from "./band";

const band = atom({ plugin: "lease", key: "band" } as const, null);
const open = atom({ plugin: "lease", key: "open" } as const, null);
const confirming = atom({ plugin: "lease", key: "confirming" } as const, false);
const showSpare = atom({ plugin: "lease", key: "showSpare" } as const, false);
const said = atom({ plugin: "lease", key: "said" } as const, "");

const EVERY_MS = 5_000; // one small file read: cheap, and a lease changes on the scale of seconds
const COOLDOWN_S = 600; // after Free it, the holder may not take anything back for ten minutes

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

// Only on his press, after he confirms: the lease command frees that hold under its lock, logs it, and stops the
// job its holder declared.
async function freeIt($: EngineInterface, chip: Chip): Promise<void> {
  const dir = await folder($);
  const argv = [
    "node",
    `${dir}/lease.mjs`,
    "free",
    "--force",
    "--name",
    chip.name,
    "--pid",
    String(chip.pid),
    "--stop-job",
    "--by",
    "Colin (Claude Code)",
    "--cooldown",
    String(COOLDOWN_S),
  ];
  const words = await $.process
    .run(argv, { timeoutMs: 90_000 })
    .then((r) =>
      r.exitCode === 0
        ? `Freed ${chip.wants} from ${chip.note || chip.name}.`
        : `lease said: ${(r.stdout || r.stderr).trim()}`,
    )
    .catch(
      (error: unknown) =>
        `could not run lease (${String(error)}); in a terminal: lease free --force --name ${chip.name}`,
    );
  await update($, said, () => words);
  await update($, open, () => null);
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
    const { Box, Button, Text } = $.ui.resolve(e);
    if (shown.unreadable) return <Text color="error">lease: the state file cannot be read; run lease show</Text>;
    const openKey = await read($, open);
    const isAsking = await read($, confirming);
    const spareShown = await read($, showSpare);
    const message = await read($, said);
    const now = await $.clock.now();
    // Cards are boxed off the terminal; on it a border would cost two rows.
    const boxed = e.surface !== "terminal";
    const toggle = (key: string) => async () => {
      await update($, confirming, () => false);
      await update($, open, (was) => (was === key ? null : key));
    };
    // One small button per held resource; the whole chip takes the click. The pointer on it reveals that chip's
    // one-line details under the row (its hover group); a click pins the card with Free it. The dot sits outside the
    // button, on its top-right corner: the desktop draws a button natively and drops the colours of text inside it.
    const chip = (c: Chip) => {
      const dot = <Text color={c.stuck === null ? "success" : "error"}>●</Text>;
      return (
        <Box key={c.key} position="relative">
          <Button
            key={`chip:${c.key}`}
            label={c.waiting.length > 0 ? `${c.tag} +${c.waiting.length}` : c.tag}
            variant={c.key === openKey ? "primary" : undefined}
            hover={{ scope: `lease:${c.key}` }}
            onPress={toggle(c.key)}
          />
          {boxed ? (
            <Box position="absolute" top={0} right={0}>
              {dot}
            </Box>
          ) : (
            dot
          )}
        </Box>
      );
    };
    const opened = shown.chips.find((c) => c.key === openKey) ?? null;
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1} alignItems="center">
          {shown.chips.map(chip)}
          {shown.spare.length > 0 ? (
            <Button
              key="spare"
              plain
              dimColor
              label={spareShown ? "‹" : `› ${shown.spare.length}`}
              onPress={() => update($, showSpare, (was) => !was)}
            />
          ) : null}
          {spareShown
            ? shown.spare.map((s) => (
                <Text key={`spare:${s.key}`} dimColor>
                  {s.label}
                </Text>
              ))
            : null}
        </Box>
        {openKey === null
          ? shown.chips.map((c) => (
              <Box key={`hover:${c.key}`} display="none" hover={{ scope: `lease:${c.key}`, display: "flex" }}>
                <Text color={c.stuck === null ? undefined : "error"} dimColor={c.stuck === null} wrap="truncate-end">
                  {hoverLine(c, now)}
                </Text>
              </Box>
            ))
          : null}
        {opened !== null ? (
          <Box flexDirection="column" paddingX={1} {...(boxed ? { borderStyle: "round", borderDimColor: true } : {})}>
            {cardLines(opened, shown, now).map((line, i) => (
              <Text key={`line:${i}`} color={i === 2 && opened.stuck !== null ? "error" : undefined} dimColor={i > 0}>
                {line}
              </Text>
            ))}
            {isAsking ? (
              <Box gap={1}>
                <Text>{freeWords(opened)}</Text>
                <Button
                  key="yes"
                  label="Yes, free it"
                  variant="primary"
                  onPress={async () => {
                    await update($, confirming, () => false);
                    await freeIt($, opened);
                  }}
                />
                <Button key="no" label="No" onPress={() => update($, confirming, () => false)} />
              </Box>
            ) : (
              <Box gap={1}>
                <Button key="free" label="Free it" onPress={() => update($, confirming, () => true)} />
                <Button key="close" label="Close" dimColor onPress={toggle(opened.key)} />
              </Box>
            )}
          </Box>
        ) : null}
        {message ? (
          <Box gap={1}>
            <Text dimColor wrap="truncate-end">
              {message}
            </Text>
            <Button key="ok" label="OK" dimColor onPress={() => update($, said, () => "")} />
          </Box>
        ) : null}
      </Box>
    );
  });
};
