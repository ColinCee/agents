/** Why a hold wants a look: its holder is gone with its job running, no renewal for a minute, or past its time. */
export type Stuck = "orphaned" | "late" | "over" | null;
/** One held resource, as one chip: a small label over the holder's name. */
export type Chip = {
  key: string;
  label: string;
  holder: string;
  stuck: Stuck;
  waiting: string[];
  name: string;
  pid: number;
  note: string;
  wants: string;
  job: boolean;
  taken: number;
  renewed: number;
  until: number | null;
};
/** A resource used before and free now, behind the band's › button. */
export type Spare = { key: string; label: string };
export type Band = { chips: Chip[]; spare: Spare[]; freeGb: number | null; unreadable: boolean };

declare module "claude-code" {
  interface PluginState {
    lease: { band: Band | null; open: string | null; confirming: boolean; showSpare: boolean; said: string };
  }
}
