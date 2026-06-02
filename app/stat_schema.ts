// stat_schema.ts
//
// EDIT THIS FILE as the meta shifts or your tracking needs change. It is the
// single source of truth for which stats the form collects and how they are
// coerced on save. Adding/removing a field here requires NO database migration
// — every value lands in builds.data (jsonb), keyed as data[category][field].
//
// The seeded fields below are a reasonable starting set, NOT gospel — The Tower
// rebalances regularly, so trim/rename to match your current patch and the
// stats you actually care about advising on.

export type FieldType = "int" | "number" | "text" | "bool" | "select";

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: string[]; // required for type "select"
}

export interface Category {
  key: string;
  title: string;
  fields: Field[];
}

const RARITY = ["Common", "Rare", "Epic", "Legendary", "Mythic", "Ancestral"];

export const STAT_SCHEMA: Category[] = [
  {
    key: "workshop_attack",
    title: "Workshop — Attack",
    fields: [
      { key: "damage", label: "Damage", type: "int" },
      { key: "attack_speed", label: "Attack Speed", type: "int" },
      { key: "crit_chance", label: "Crit Chance", type: "int" },
      { key: "crit_factor", label: "Crit Factor", type: "int" },
      { key: "range", label: "Range", type: "int" },
      { key: "damage_per_meter", label: "Damage / Meter", type: "int" },
      { key: "multishot_chance", label: "Multishot Chance", type: "int" },
      { key: "multishot_targets", label: "Multishot Targets", type: "int" },
    ],
  },
  {
    key: "workshop_defense",
    title: "Workshop — Defense",
    fields: [
      { key: "health", label: "Health", type: "int" },
      { key: "health_regen", label: "Health Regen", type: "int" },
      { key: "defense_percent", label: "Defense %", type: "int" },
      { key: "defense_absolute", label: "Defense Absolute", type: "int" },
      { key: "thorns", label: "Thorns", type: "int" },
      { key: "lifesteal", label: "Lifesteal", type: "int" },
    ],
  },
  {
    key: "workshop_utility",
    title: "Workshop — Utility",
    fields: [
      { key: "cash_bonus", label: "Cash Bonus", type: "int" },
      { key: "coins_per_kill", label: "Coins / Kill Bonus", type: "int" },
      { key: "interest", label: "Interest", type: "int" },
      { key: "recovery_amount", label: "Recovery Amount", type: "int" },
    ],
  },
  {
    key: "ultimate_weapons",
    title: "Ultimate Weapons (level, 0 = locked)",
    fields: [
      { key: "golden_tower", label: "Golden Tower", type: "int" },
      { key: "black_hole", label: "Black Hole", type: "int" },
      { key: "death_wave", label: "Death Wave", type: "int" },
      { key: "spotlight", label: "Spotlight", type: "int" },
      { key: "chain_lightning", label: "Chain Lightning", type: "int" },
      { key: "smart_missiles", label: "Smart Missiles", type: "int" },
    ],
  },
  {
    key: "modules",
    title: "Modules",
    fields: [
      { key: "cannon_name", label: "Cannon — Name", type: "text" },
      { key: "cannon_rarity", label: "Cannon — Rarity", type: "select", options: RARITY },
      { key: "cannon_level", label: "Cannon — Level", type: "int" },
      { key: "armor_name", label: "Armor — Name", type: "text" },
      { key: "armor_rarity", label: "Armor — Rarity", type: "select", options: RARITY },
      { key: "armor_level", label: "Armor — Level", type: "int" },
      { key: "generator_name", label: "Generator — Name", type: "text" },
      { key: "generator_level", label: "Generator — Level", type: "int" },
      { key: "core_name", label: "Core — Name", type: "text" },
      { key: "core_level", label: "Core — Level", type: "int" },
    ],
  },
];

// Coerce a raw form string into the right JS type for storage.
export function coerce(type: FieldType, raw: string | null): unknown {
  if (raw === null || raw === "") return null;
  switch (type) {
    case "int":
      return Number.isFinite(Number(raw)) ? Math.trunc(Number(raw)) : null;
    case "number":
      return Number.isFinite(Number(raw)) ? Number(raw) : null;
    case "bool":
      return raw === "on" || raw === "true";
    default:
      return raw;
  }
}
