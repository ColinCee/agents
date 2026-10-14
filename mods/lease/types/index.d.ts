export type BandKind = "free" | "held" | "orphaned" | "unreadable";
export type Band = { kind: BandKind; line: string; holder: string; job: boolean; waiting: string };

declare module "claude-code" {
  interface PluginState {
    lease: { band: Band | null; confirming: boolean; said: string };
  }
}
