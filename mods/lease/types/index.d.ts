/** Why a hold wants a look: its holder is gone with its job running, no renewal for a minute, or past its time. */
export type Stuck = "orphaned" | "late" | "over" | null;
/** One holder, as one line of the band: who, what, how long, and anything wrong. */
export type Line = { key: string; stuck: Stuck; text: string; problem: string };
export type Band = { lines: Line[]; unreadable: boolean };

declare module "claude-code" {
  interface PluginState {
    lease: { band: Band | null };
  }
}
