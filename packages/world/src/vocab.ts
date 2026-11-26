// Plain-language words the Resident may read. Describes the world only: no body, no hidden state.
import type { Station } from "@truman/contracts";
import type { FireState, NodeKind, ResourceNode, WeatherKind } from "./types";

export const STATION_PHRASE: Record<Station, string> = {
  desk: "the desk",
  bed: "the bed",
  journal_table: "the small table",
  window: "the window",
  door: "the door",
  river: "the river bank",
  forest_edge: "the edge of the forest",
  clearing: "the clearing",
  mirror_pool: "the still pool",
};

export const STATION_THING: Record<string, string> = {
  desk: "a plain wooden desk",
  bed: "a narrow bed with a rough wool cover",
  journal_table: "a small table with a bare top",
  window: "a small window",
  door: "a plank door",
};

export interface Words {
  one: string;
  many: string;
}

const w = (one: string, many: string): Words => ({ one, many });

export function nodeWords(n: ResourceNode): Words {
  const full = n.cap > 0 ? n.amount / n.cap : 0;
  const has = n.amount >= 1;
  switch (n.kind as NodeKind) {
    case "tree":
      return w("a tall tree", "tall trees");
    case "berry_bush":
      return has
        ? full > 0.6
          ? w("a low bush heavy with dark berries", "low bushes heavy with berries")
          : w("a low bush with a few dark berries", "low bushes with a few berries")
        : w("a low bush with bare branches", "low bushes with bare branches");
    case "fruit_tree":
      return has
        ? full > 0.5
          ? w("a fruit tree hung with fruit", "fruit trees hung with fruit")
          : w("a fruit tree with a little fruit left", "fruit trees with a little fruit")
        : w("a fruit tree with no fruit on it", "fruit trees with no fruit");
    case "root_patch":
      return has
        ? w("a patch of low leafy plants", "patches of low leafy plants")
        : w("a patch of turned, trampled earth", "patches of trampled earth");
    case "herb_patch":
      return has
        ? w("a patch of fragrant green herbs", "patches of green herbs")
        : w("a patch of thin, sparse herbs", "patches of sparse herbs");
    case "mushroom_patch":
      return has
        ? w("a cluster of pale mushrooms in the damp", "clusters of pale mushrooms")
        : w("a damp spot where mushrooms have been", "damp spots with no mushrooms");
    case "deadwood":
      return has
        ? w("a heap of dry fallen branches", "heaps of dry branches")
        : w("a few bare scraps of twig", "scraps of twig");
    case "stone_outcrop":
      return w("a grey outcrop of stones", "grey outcrops of stones");
    case "flint_nodule":
      return w("dark nodules of flint in the ground", "scatters of dark flint");
    case "clay_bank":
      return w("a bank of smooth pale clay", "banks of pale clay");
    case "reed_bed":
      return has
        ? w("a stand of tall reeds", "stands of tall reeds")
        : w("a flattened stand of reeds", "flattened reeds");
    case "fish_shoal":
      return has
        ? w("a flicker of fish in the water", "flickers of fish")
        : w("quiet, empty water", "quiet water");
    case "woodpile":
      return has
        ? w("a neat stack of split firewood", "stacks of firewood")
        : w("a bare patch where firewood was stacked", "bare patches");
  }
}

export function fireWords(s: FireState): Words {
  switch (s) {
    case "lit":
      return w("a young fire, crackling", "young fires");
    case "burning":
      return w("a steady fire", "steady fires");
    case "dying":
      return w("a fire burning low", "low fires");
    case "out":
      return w("a ring of cold ash", "rings of cold ash");
  }
}

export const WEATHER_LINE = (kind: WeatherKind, precip: number): string => {
  switch (kind) {
    case "clear":
      return "The sky is clear.";
    case "cloudy":
      return "Grey cloud covers the sky.";
    case "fog":
      return "A low mist hangs over everything.";
    case "rain":
      return precip > 0.7 ? "Rain pours down hard." : "A light rain is falling.";
    case "snow":
      return precip > 0.7 ? "Thick snow is falling." : "A few snowflakes drift down.";
  }
};
/** Outdoors as seen or heard from inside the cabin. */
export const INDOOR_WEATHER_LINE = (kind: WeatherKind, precip: number): string => {
  switch (kind) {
    case "clear":
      return "Daylight comes in through the window.";
    case "cloudy":
      return "Only a dull grey light comes in through the window.";
    case "fog":
      return "The window shows nothing but pale mist.";
    case "rain":
      return precip > 0.7 ? "Rain drums hard on the roof." : "Rain taps softly on the roof.";
    case "snow":
      return precip > 0.7
        ? "Snow piles thickly against the window."
        : "A few snowflakes drift past the window.";
  }
};
export const INDOOR_LIGHT_LINE = {
  dawn: "A faint light is starting to show at the window.",
  dusk: "The light at the window is fading.",
  night: "It is dark in here, and the window shows only black.",
} as const;
export const WIND_LINE = "A strong wind pushes through the branches.";
export const LIGHT_LINE = {
  dawn: "The light is just coming up.",
  dusk: "The light is fading.",
  night: "It is night, and the dark hides most things.",
} as const;

export const CABIN_WORDS = "a small wooden cabin with a plank door";
export const RIVER_WORDS = "a slow brown river";
export const SPRING_WORDS = "a small spring welling up between mossy stones";
export const POOL_WORDS = "a round pool of very still dark water";
export const EDGE_WORDS = "a wall of thick, tangled thorn that cannot be pushed through";
export const MIRROR_LINE =
  "The water is so still that it shows the sky, and a shape looking back up at you.";
