// stat_schema.ts
//
// EDIT THIS FILE as the meta shifts or your tracking needs change. It is the
// single source of truth for which stats the form collects and how they are
// coerced on save. Adding/removing a field here requires NO database migration
// — every value lands in builds.data (jsonb), keyed as data[category][field].
//
// Fields with an `enhancement` property render as a paired two-column layout:
// upgrade inputs tab through first (matching the in-game Workshop screen),
// then enhancement inputs (matching the Enhancements screen). Enhancement
// values are stored flat in the same category namespace with their own key.

import { type NumUnit, parseHuman } from "./num_format.ts";
import type { Formula } from "./stat_formula.ts";

export type FieldType = "int" | "number" | "text" | "bool" | "select";

export interface Enhancement {
  key: string;
  label: string;
  type: FieldType;
  // How the numeric value is parsed on input and formatted on display.
  // Omitted = "num" (plain magnitude). See app/num_format.ts.
  unit?: NumUnit;
  options?: string[];
  // When set, the form offers a level input that computes this value (and the
  // server recomputes it on save). See app/stat_formula.ts. Stored as a
  // sibling `<key>_lvl` in the same category namespace.
  formula?: Formula;
}

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  unit?: NumUnit;
  options?: string[];
  enhancement?: Enhancement;
  // Level→value scaling; see Enhancement.formula above and app/stat_formula.ts.
  formula?: Formula;
  // When set, the renderer lays the category out as one column per group
  // (used by Modules: a column per Cannon/Armor/Generator/Core). All fields in
  // a group share the same {key,label}; coercion/storage is unaffected.
  group?: { key: string; label: string };
}

export interface Category {
  key: string;
  title: string;
  fields: Field[];
}

// Full module rarity ladder including the "+" merge tiers.
const RARITY = [
  "Common",
  "Rare",
  "Rare+",
  "Epic",
  "Epic+",
  "Legendary",
  "Legendary+",
  "Mythic",
  "Mythic+",
  "Ancestral",
  "Ancestral+",
];

// Shorthand for the common enhancement (all enhancements are × multipliers,
// e.g. ×1.012 — so they're decimal-valued and formatted as multipliers). Pass a
// `formula` for the linear enhancements whose level→value scaling is documented
// on the wiki (most ×enhancements are base 1 + 0.01/level, varying max level).
const enh = (key: string, label: string, formula?: Formula): Enhancement => ({
  key,
  label,
  type: "number",
  unit: "mult",
  formula,
});

// Sub-module effect pools per module type (sourced from the Fandom wiki's
// "Sub-Module Effects" page). Cores roll a per-Ultimate-Weapon effect, flattened
// here as "<UW> — <stat>". Edit these as the game's effect lists change.
const CANNON_SUBS = [
  "Attack Speed",
  "Crit Chance",
  "Crit Factor",
  "Attack Range",
  "Damage / Meter",
  "Multishot Chance",
  "Multishot Targets",
  "Rapid Fire Chance",
  "Rapid Fire Duration",
  "Bounce Shot Chance",
  "Bounce Shot Targets",
  "Bounce Shot Range",
  "Super Crit Chance",
  "Super Crit Multi",
  "Rend Armor Chance",
  "Rend Armor Multi",
  "Max Rend Armor Multi",
];
const ARMOR_SUBS = [
  "Health Regen",
  "Defense %",
  "Defense Absolute",
  "Thorn Damage",
  "Lifesteal",
  "Knockback Chance",
  "Knockback Force",
  "Orb Speed",
  "Orbs",
  "Shockwave Size",
  "Shockwave Frequency",
  "Land Mine Damage",
  "Land Mine Chance",
  "Land Mine Radius",
  "Death Defy",
  "Wall Health",
  "Wall Rebuild",
];
const GENERATOR_SUBS = [
  "Cash Bonus",
  "Cash / Wave",
  "Coins / Kill Bonus",
  "Coins / Wave",
  "Free Attack Upgrade",
  "Free Defense Upgrade",
  "Free Utility Upgrade",
  "Interest / Wave",
  "Recovery Amount",
  "Max Recovery",
  "Package Chance",
  "Enemy Attack Level Skip",
  "Enemy Health Level Skip",
];
const CORE_SUBS = [
  "Golden Tower — Bonus",
  "Golden Tower — Duration",
  "Golden Tower — Cooldown",
  "Black Hole — Size",
  "Black Hole — Duration",
  "Black Hole — Cooldown",
  "Spotlight — Bonus",
  "Spotlight — Angle",
  "Chrono Field — Duration",
  "Chrono Field — Speed Reduction",
  "Chrono Field — Cooldown",
  "Death Wave — Damage",
  "Death Wave — Quantity",
  "Death Wave — Cooldown",
  "Smart Missiles — Damage",
  "Smart Missiles — Quantity",
  "Smart Missiles — Cooldown",
  "Inner Land Mines — Damage",
  "Inner Land Mines — Quantity",
  "Inner Land Mines — Cooldown",
  "Poison Swamp — Damage",
  "Poison Swamp — Duration",
  "Poison Swamp — Cooldown",
  "Chain Lightning — Damage",
  "Chain Lightning — Quantity",
  "Chain Lightning — Chance",
];

// One module's fields: Name, Module Rarity, Level, Main Effect, then six substat
// slots. Each slot mirrors the in-game card: its own rarity (the colored pill
// that scales the roll), an effect picker (from the module type's pool), and a
// free-text value. Slots unlock in-game at module levels 41/101/141/161/201/241.
// All tagged with the same `group` so the renderer gives each module its own
// column.
const MODULE_SLOTS = 6;
const modFields = (key: string, label: string, pool: string[]): Field[] => {
  const group = { key, label };
  const head: Field[] = [
    { key: `${key}_name`, label: "Name", type: "text", group },
    { key: `${key}_rarity`, label: "Module Rarity", type: "select", options: RARITY, group },
    { key: `${key}_level`, label: "Level", type: "int", group },
    // The module's signature effect, e.g. "×6.750 Tower Health" — its type is
    // fixed per named module, so store the whole line as free text.
    { key: `${key}_effect`, label: "Main Effect", type: "text", group },
  ];
  const slots: Field[] = [];
  for (let i = 1; i <= MODULE_SLOTS; i++) {
    // The slot's leading field is the rarity pill; the renderer pairs it with
    // the following effect + value into one labelled "Substat N" row.
    slots.push({
      key: `${key}_sub${i}_rarity`,
      label: `Substat ${i}`,
      type: "select",
      options: RARITY,
      group,
    });
    slots.push({
      key: `${key}_sub${i}_type`,
      label: `Substat ${i} effect`,
      type: "select",
      options: pool,
      group,
    });
    slots.push({ key: `${key}_sub${i}_val`, label: `Substat ${i} value`, type: "text", group });
  }
  return [...head, ...slots];
};

export const STAT_SCHEMA: Category[] = [
  {
    key: "workshop_attack",
    title: "Workshop — Attack",
    fields: [
      // Damage's base value is a ~6000-level tiered grind with no clean closed
      // form, so it stays manual; its enhancement (Damage ×) is linear.
      {
        key: "damage",
        label: "Damage",
        type: "int",
        enhancement: enh("damage_enh", "Damage ×", { base: 1, increment: 0.01, maxLevel: 400 }),
      },
      {
        key: "attack_speed",
        label: "Attack Speed",
        type: "int",
        formula: { base: 1, increment: 0.05, maxLevel: 99 },
        enhancement: enh("attack_speed_enh", "Attack Speed ×", {
          base: 1,
          increment: 0.01,
          maxLevel: 75,
        }),
      },
      {
        key: "crit_chance",
        label: "Crit Chance",
        type: "number",
        unit: "pct",
        formula: { base: 1, increment: 1, maxLevel: 79 },
      },
      {
        key: "crit_factor",
        label: "Crit Factor",
        type: "number",
        unit: "mult",
        formula: { base: 1.2, increment: 0.1, maxLevel: 150 },
        enhancement: enh("crit_factor_enh", "Crit Factor ×", {
          base: 1,
          increment: 0.01,
          maxLevel: 400,
        }),
      },
      { key: "range", label: "Attack Range", type: "int" },
      {
        key: "damage_per_meter",
        label: "Damage / Meter",
        type: "number",
        unit: "mult",
        enhancement: enh("damage_per_meter_enh", "Damage / Meter ×"),
      },
      {
        key: "multishot_chance",
        label: "Multishot Chance",
        type: "number",
        unit: "pct",
        formula: { base: 0, increment: 0.5, maxLevel: 99 },
      },
      {
        key: "multishot_targets",
        label: "Multishot Targets",
        type: "int",
        formula: { base: 2, increment: 1, maxLevel: 7 },
      },
      { key: "rapid_fire_chance", label: "Rapid Fire Chance", type: "number", unit: "pct" },
      { key: "rapid_fire_dur", label: "Rapid Fire Duration", type: "number", unit: "sec" },
      { key: "bounce_chance", label: "Bounce Shot Chance", type: "number", unit: "pct" },
      { key: "bounce_targets", label: "Bounce Shot Targets", type: "int" },
      { key: "bounce_range", label: "Bounce Shot Range", type: "int" },
      { key: "super_crit_chance", label: "Super Crit Chance", type: "number", unit: "pct" },
      {
        key: "super_crit_multi",
        label: "Super Crit Multi",
        type: "number",
        unit: "mult",
        enhancement: enh("super_crit_multi_enh", "Super Crit Multi ×"),
      },
      {
        key: "rend_chance",
        label: "Rend Armor Chance",
        type: "number",
        unit: "pct",
        enhancement: enh("rend_enh", "Rend Armor ×"),
      },
      { key: "rend_mult", label: "Rend Armor Mult", type: "number", unit: "mult" },
    ],
  },
  {
    key: "workshop_defense",
    title: "Workshop — Defense",
    fields: [
      { key: "health", label: "Health", type: "int", enhancement: enh("health_enh", "Health ×") },
      {
        key: "health_regen",
        label: "Health Regen",
        type: "int",
        enhancement: enh("health_regen_enh", "Health Regen ×"),
      },
      { key: "defense_percent", label: "Defense %", type: "number", unit: "pct" },
      {
        key: "defense_absolute",
        label: "Defense Absolute",
        type: "int",
        enhancement: enh("defense_absolute_enh", "Defense Absolute ×"),
      },
      { key: "thorns", label: "Thorn Damage", type: "number", unit: "pct" },
      { key: "lifesteal", label: "Lifesteal", type: "number", unit: "pct" },
      { key: "knockback_chance", label: "Knockback Chance", type: "number", unit: "pct" },
      { key: "knockback_force", label: "Knockback Force", type: "int" },
      { key: "orb_speed", label: "Orb Speed", type: "int" },
      { key: "orbs", label: "Orbs", type: "int", enhancement: enh("orb_size_enh", "Orb Size ×") },
      { key: "shockwave_size", label: "Shockwave Size", type: "int" },
      { key: "shockwave_freq", label: "Shockwave Frequency", type: "number", unit: "sec" },
      { key: "land_mine_chance", label: "Land Mine Chance", type: "number", unit: "pct" },
      {
        key: "land_mine_damage",
        label: "Land Mine Damage",
        type: "int",
        enhancement: enh("land_mine_damage_enh", "Land Mine Damage ×"),
      },
      { key: "land_mine_radius", label: "Land Mine Radius", type: "int" },
      { key: "death_defy", label: "Death Defy", type: "number", unit: "pct" },
      {
        key: "wall_health",
        label: "Wall Health",
        type: "number",
        unit: "pct", // % of tower health, 20% → 200% (verified against wiki)
        enhancement: enh("wall_health_enh", "Wall Health ×"),
      },
      { key: "wall_rebuild", label: "Wall Rebuild", type: "number", unit: "sec" },
    ],
  },
  {
    key: "workshop_utility",
    title: "Workshop — Utility",
    fields: [
      {
        key: "cash_bonus",
        label: "Cash Bonus",
        type: "number",
        unit: "mult", // shown as ×1.00 → ×2.49 in-game (verified against wiki)
        enhancement: enh("cash_bonus_enh", "Cash Bonus ×"),
      },
      { key: "cash_wave", label: "Cash / Wave", type: "int" },
      {
        key: "coins_per_kill",
        label: "Coins / Kill",
        type: "int",
        enhancement: enh("coin_bonus_enh", "Coin Bonus ×"),
      },
      { key: "coins_wave", label: "Coins / Wave", type: "int" },
      { key: "interest", label: "Interest", type: "number", unit: "pct" },
      {
        key: "recovery_amount",
        label: "Recovery Amount",
        type: "number",
        unit: "pct",
        enhancement: enh("packages_enh", "Packages ×"),
      },
      { key: "max_recovery", label: "Max Recovery", type: "number", unit: "mult" },
      { key: "package_chance", label: "Package Chance", type: "number", unit: "pct" },
      {
        key: "free_attack",
        label: "Free Attack Upgrades",
        type: "number",
        unit: "pct",
        enhancement: enh("free_upgrades_enh", "Free Upgrades ×"),
      },
      { key: "free_defense", label: "Free Defense Upgrades", type: "number", unit: "pct" },
      { key: "free_utility", label: "Free Utility Upgrades", type: "number", unit: "pct" },
      { key: "cells_kill_bonus", label: "Cells / Kill Bonus (Enh)", type: "int" },
      // The Upgrade tab has two separate level-skip upgrades (Attack / Health),
      // but the Enhance tab has a single unified "Enemy Level Skip +" multiplier
      // (×1.07 in-game). Model it as one shared enhancement hung off the Attack
      // upgrade; the Health upgrade carries no enhancement of its own.
      {
        key: "enemy_atk_level_skip",
        label: "Enemy Attack Level Skip",
        type: "number",
        unit: "pct",
        enhancement: enh("enemy_level_skip_enh", "Enemy Level Skip ×"),
      },
      {
        key: "enemy_hp_level_skip",
        label: "Enemy Health Level Skip",
        type: "number",
        unit: "pct",
      },
    ],
  },
  // Ultimate Weapons — each weapon is its own group, tracking the value of every
  // one of its sub-stats. A section left blank = the weapon isn't unlocked yet.
  // Sub-stat field keys repeat across weapons (e.g. `cooldown`); that's fine,
  // they're namespaced by the category key.
  {
    key: "uw_golden_tower",
    title: "UW — Golden Tower",
    fields: [
      { key: "bonus", label: "Bonus", type: "number", unit: "mult" },
      { key: "duration", label: "Duration", type: "number", unit: "sec" },
      { key: "cooldown", label: "Cooldown", type: "number", unit: "sec" },
    ],
  },
  {
    key: "uw_death_wave",
    title: "UW — Death Wave",
    fields: [
      { key: "damage", label: "Damage", type: "number", unit: "mult" },
      { key: "quantity", label: "Quantity", type: "int" },
      { key: "cooldown", label: "Cooldown", type: "number", unit: "sec" },
    ],
  },
  {
    key: "uw_black_hole",
    title: "UW — Black Hole",
    fields: [
      { key: "size", label: "Size", type: "int" },
      { key: "duration", label: "Duration", type: "number", unit: "sec" },
      { key: "cooldown", label: "Cooldown", type: "number", unit: "sec" },
    ],
  },
  {
    key: "uw_spotlight",
    title: "UW — Spotlight",
    fields: [
      { key: "bonus", label: "Bonus", type: "number", unit: "mult" },
      { key: "angle", label: "Angle", type: "int" },
      { key: "quantity", label: "Quantity", type: "int" },
    ],
  },
  {
    key: "uw_chain_lightning",
    title: "UW — Chain Lightning",
    fields: [
      { key: "damage", label: "Damage", type: "number", unit: "mult" },
      { key: "quantity", label: "Quantity", type: "int" },
      { key: "chance", label: "Chance", type: "number", unit: "pct" },
    ],
  },
  {
    key: "uw_smart_missiles",
    title: "UW — Smart Missiles",
    fields: [
      { key: "damage", label: "Damage", type: "number", unit: "mult" },
      { key: "quantity", label: "Quantity", type: "int" },
      { key: "cooldown", label: "Cooldown", type: "number", unit: "sec" },
    ],
  },
  {
    key: "uw_poison_swamp",
    title: "UW — Poison Swamp",
    fields: [
      { key: "damage", label: "Damage", type: "number", unit: "mult" },
      { key: "duration", label: "Duration", type: "number", unit: "sec" },
      { key: "cooldown", label: "Cooldown", type: "number", unit: "sec" },
    ],
  },
  {
    key: "uw_inner_land_mines",
    title: "UW — Inner Land Mines",
    // Sub-stats per the Fandom wiki (Inner Land Mines/Basic Upgrades): Damage is
    // a × multiplier (10× → 3021×), Quantity a count, Cooldown in seconds.
    fields: [
      { key: "damage", label: "Damage", type: "number", unit: "mult" },
      { key: "quantity", label: "Quantity", type: "int" },
      { key: "cooldown", label: "Cooldown", type: "number", unit: "sec" },
    ],
  },
  {
    key: "uw_chrono_field",
    title: "UW — Chrono Field",
    // Sub-stats per the Fandom wiki (Chrono Field/Basic Upgrades): Duration (s),
    // Speed Reduction / "Slow" (%), Cooldown (s).
    fields: [
      { key: "duration", label: "Duration", type: "number", unit: "sec" },
      { key: "speed_reduction", label: "Speed Reduction", type: "number", unit: "pct" },
      { key: "cooldown", label: "Cooldown", type: "number", unit: "sec" },
    ],
  },
  {
    key: "modules",
    title: "Modules",
    fields: [
      ...modFields("cannon", "Cannon", CANNON_SUBS),
      ...modFields("armor", "Armor", ARMOR_SUBS),
      ...modFields("generator", "Generator", GENERATOR_SUBS),
      ...modFields("core", "Core", CORE_SUBS),
    ],
  },
];

// Coerce a raw form string into the right JS type for storage. Numeric fields
// (int/number) accept human shorthand — "869.03M", "56.4%", "×1.012", "14s" —
// parsed per the field's `unit` (see app/num_format.ts). Unparseable numeric
// input yields null (the field is simply not stored).
export function coerce(type: FieldType, raw: string | null, unit: NumUnit = "num"): unknown {
  if (raw === null || raw === "") return null;
  switch (type) {
    case "int":
    case "number":
      return parseHuman(raw, unit);
    case "bool":
      return raw === "on" || raw === "true";
    default:
      return raw;
  }
}
