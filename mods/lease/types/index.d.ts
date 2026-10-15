/** Why a hold wants a look: its holder is gone with its job running, no renewal for a minute, or past its time. */
export type Stuck = "orphaned" | "late" | "over" | null;
/** How a line is drawn: fine (green), stuck (red), or something using the GPU with no lock (yellow). */
export type Tone = "ok" | "stuck" | "unlocked";
/** One holder, as one line of the band: who, what, how long, and anything wrong. */
export type Line = { key: string; tone: Tone; text: string; problem: string };
export type Band = { lines: Line[]; unreadable: boolean };

declare module "claude-code" {
  interface PluginState {
    lease: { band: Band | null };
  }
}
