/** How a part is drawn: fine (dim), stuck (red), or something using the GPU with no lock (yellow). */
export type Tone = "ok" | "stuck" | "unlocked";
/** One short part of the band's row: free and leased RAM, a holder and its status, the GPU, or who waits. */
export type Part = { key: string; text: string; tone: Tone };
/** The band's one row; `tone` is its worst part's, `problem` says what is wrong, once, at its end. */
export type Band = { parts: Part[]; tone: Tone; problem: string; unreadable: boolean };

declare module "claude-code" {
  interface PluginState {
    lease: { band: Band | null };
  }
}
