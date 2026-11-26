import { Event, Snapshot, type LiveFeed, type InventoryItem } from "@truman/contracts";
import { vitals } from "@truman/body";
import { dayIndex, fireState, seasonAt, timeOfDay, weatherAt } from "@truman/world";
import { physiologyNow } from "../tick/senses";
import type { MindState } from "../tick/state";

export interface SnapshotSource {
  tickId: number;
  started: Date;
  tickMinutes: number;
  mind: MindState;
  mode: string;
  status: string;
  phase: string;
  lastTickAt: unknown;
}

export type SnapshotPublisher = (source: SnapshotSource) => Promise<void>;
export type SnapshotWriter = (feed: LiveFeed) => Promise<void>;
export type SnapshotEventReader = (from: Date, until: Date) => Promise<unknown>;

function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

const animationNames = new Set(["thinking", "read", "write", "rest", "tend_fire", "work"]);

/** Keep narration in the dynamic log so takedowns apply even to old static deployments. */
function publicEvents(raw: unknown): Event[] {
  if (!Array.isArray(raw)) throw new Error("snapshot event query returned an invalid response");
  const events: Event[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    if (row.log_id !== null && row.entry?.hidden !== false) continue;

    let kind: string = row.kind;
    let data: unknown = row.data;
    if (kind === "thought") {
      kind = "anim";
      data = { name: "thinking" };
    } else if (kind === "journal") {
      kind = "anim";
      data = { name: "write", station: "journal_table" };
    } else if (kind === "web_visit") {
      kind = "anim";
      data = { name: "read" };
    } else if (kind === "dream" || (kind === "anim" && !animationNames.has(row.data?.name))) {
      continue;
    } else if (kind === "status") {
      data = { status: row.data?.status };
    }

    const parsed = Event.safeParse({
      v: row.v,
      seq: row.seq,
      t_start: isoDate(row.t_start),
      t_end: isoDate(row.t_end),
      actor: row.actor,
      kind,
      data,
      log_id: row.log_id,
    });
    if (parsed.success) events.push(parsed.data);
  }
  return events.sort((a, b) => a.seq - b.seq);
}

function publicInventory(inventory: InventoryItem[]): InventoryItem[] {
  return inventory.map(({ item, qty, condition, props }) => {
    const fill = props?.["fill"];
    const quality = props?.["quality"];
    const worn = props?.["worn"];
    return {
      item,
      qty,
      condition,
      props: {
        ...(typeof fill === "number" ? { fill } : {}),
        ...(quality === "clean" || quality === "river" || quality === "pool" || quality === "boiled"
          ? { quality }
          : {}),
        ...(typeof worn === "boolean" ? { worn } : {}),
      },
    };
  });
}

export function createSnapshotPublisher(
  readEvents: SnapshotEventReader,
  write: SnapshotWriter,
): SnapshotPublisher {
  return async (source) => {
    const { tickId, started, tickMinutes, mind, mode, status, phase, lastTickAt } = source;
    const windowMs = tickMinutes * 60_000;
    const until = new Date(started.getTime() + windowMs);
    const events = publicEvents(await readEvents(started, until));
    const world = mind.world;
    const clock = Math.min(world.t, Math.max(0, (started.getTime() - mind.born_ms) / 60_000));
    const snapshot = Snapshot.parse({
      v: world.v,
      seq: tickId,
      generated_at: started.toISOString(),
      world: {
        seed: world.seed,
        weather: weatherAt(world, clock).kind,
        time_of_day: timeOfDay(world, clock),
        entities: [
          ...world.fires.map((fire) => ({
            id: fire.hearth ? "hearth_fire" : `fire_${fire.id}`,
            type: "fire",
            x: fire.x,
            z: fire.z,
            appearance: { state: fireState(fire, clock) },
          })),
          ...world.nodes.map((node) => ({
            id: node.id,
            type: node.kind,
            x: node.x,
            z: node.z,
            appearance: { amount: node.amount },
          })),
        ],
      },
      resident: {
        pose: mind.pos,
        station: mind.station,
        body: physiologyNow(mind),
        vitals: vitals(mind.body),
        inventory: publicInventory(mind.inventory),
        phase,
      },
      status,
    });
    await write({
      snapshot,
      events,
      status: {
        status,
        phase,
        day: Math.floor(clock / 1440) + 1,
        last_tick_at: isoDate(lastTickAt),
        mode,
        world_day: dayIndex(world, clock) + 1,
        season: seasonAt(clock),
      },
    });
  };
}
