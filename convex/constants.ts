// Shared between Convex functions and the client UI.

export const CATEGORIES = [
  { id: "ppg10", label: "Active, 10+ PPG" },
  { id: "allstars", label: "Active All-Stars" },
  { id: "hof", label: "Hall of Famers" },
  { id: "defense", label: "Active All-Defense" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as string[];

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export const LEVELS = ["easy", "medium", "hard", "impossible"] as const;
export type Level = (typeof LEVELS)[number];

export const SETTING_LEVELS = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
  { id: "impossible", label: "Impossible" },
  { id: "random", label: "Random" },
] as const;

export type SettingLevel = (typeof SETTING_LEVELS)[number]["id"];

// Obscurity level -> nbaPlayers.popularityTier
export const OBSCURITY_TIER: Record<Level, 1 | 2 | 3 | 4> = {
  easy: 1,
  medium: 2,
  hard: 3,
  impossible: 4,
};

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;

// 4-letter room codes from an unambiguous alphabet (no O or I).
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_LENGTH = 4;

export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
