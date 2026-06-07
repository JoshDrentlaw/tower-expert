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

export type FieldType = "int" | "number" | "text" | "bool" | "select";

export interface Enhancement {
  key: string;
  label: string;
  type: FieldType;
  // How the numeric value is parsed on input and formatted on display.
  // Omitted = "num" (plain magnitude). See app/num_format.ts.
  unit?: NumUnit;
  options?: string[];
}

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  unit?: NumUnit;
  options?: string[];
  enhancement?: Enhancement;
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
// e.g. ×1.012 — so they're decimal-valued and formatted as multipliers).
const enh = (key: string, label: string): Enhancement => ({
  key,
  label,
  type: "number",
  unit: "mult",
});

// One module's fields: Name, Rarity, Level, and six free-text substat slots
// (unlocked in-game at module levels 41/101/141/161/201/241). All tagged with
// the same `group` so the renderer gives each module its own column.
const MODULE_SLOTS = 6;
const modFields = (key: string, label: string): Field[] => {
  const group = { key, label };
  return [
    { key: `${key}_name`, label: "Name", type: "text", group },
    { key: `${key}_rarity`, label: "Rarity", type: "select", options: RARITY, group },
    { key: `${key}_level`, label: "Level", type: "int", group },
    ...Array.from({ length: MODULE_SLOTS }, (_, i): Field => ({
      key: `${key}_sub${i + 1}`,
      label: `Substat ${i + 1}`,
      type: "text",
      group,
    })),
  ];
};

export const STAT_SCHEMA: Category[] = [
  {
    key: "workshop_attack",
    title: "Workshop — Attack",
    fields: [
      { key: "damage", label: "Damage", type: "int", enhancement: enh("damage_enh", "Damage ×") },
      {
        key: "attack_speed",
        label: "Attack Speed",
        type: "int",
        enhancement: enh("attack_speed_enh", "Attack Speed ×"),
      },
      { key: "crit_chance", label: "Crit Chance", type: "number", unit: "pct" },
      {
        key: "crit_factor",
        label: "Crit Factor",
        type: "number",
        unit: "mult",
        enhancement: enh("crit_factor_enh", "Crit Factor ×"),
      },
      { key: "range", label: "Range", type: "int" },
      {
        key: "damage_per_meter",
        label: "Damage / Meter",
        type: "number",
        unit: "mult",
        enhancement: enh("damage_per_meter_enh", "Damage / Meter ×"),
      },
      { key: "multishot_chance", label: "Multishot Chance", type: "number", unit: "pct" },
      { key: "multishot_targets", label: "Multishot Targets", type: "int" },
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
      { key: "orbs", label: "Orbs", type: "int", enhancement: enh("orb_size_enh", "Orb Size ×") },
      { key: "orb_speed", label: "Orb Speed", type: "int" },
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
      {
        key: "enemy_atk_level_skip",
        label: "Enemy Atk Level Skip",
        type: "number",
        unit: "pct",
        enhancement: {
          key: "enemy_atk_level_skip_enh",
          label: "Enemy Atk Level Skip (Enh)",
          type: "number",
          unit: "pct",
        },
      },
      {
        key: "enemy_hp_level_skip",
        label: "Enemy HP Level Skip",
        type: "number",
        unit: "pct",
        enhancement: {
          key: "enemy_hp_level_skip_enh",
          label: "Enemy HP Level Skip (Enh)",
          type: "number",
          unit: "pct",
        },
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
      { key: "damage_amp", label: "Damage Amp", type: "number", unit: "mult" },
      { key: "quantity", label: "Quantity", type: "int" },
      { key: "cooldown", label: "Cooldown", type: "number", unit: "sec" },
      { key: "health_bonus", label: "Health Bonus", type: "number", unit: "pct" },
      { key: "coin_bonus", label: "Coin Bonus", type: "number", unit: "mult" },
      { key: "cell_bonus", label: "Cell Bonus", type: "number", unit: "mult" },
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
      { key: "recharge", label: "Recharge", type: "number", unit: "sec" },
      { key: "despawn", label: "Despawn Time", type: "number", unit: "sec" },
      { key: "radius", label: "Radius", type: "int" },
      { key: "explosions", label: "Explosions", type: "int" },
      { key: "barrage", label: "Barrage", type: "int" },
    ],
  },
  {
    key: "uw_poison_swamp",
    title: "UW — Poison Swamp",
    fields: [
      { key: "damage", label: "Damage", type: "number", unit: "mult" },
      { key: "duration", label: "Duration", type: "number", unit: "sec" },
      { key: "radius", label: "Radius", type: "int" },
      { key: "stun_chance", label: "Stun Chance", type: "number", unit: "pct" },
      { key: "stun_time", label: "Stun Time", type: "number", unit: "sec" },
      { key: "rend", label: "Rend", type: "number", unit: "mult" },
    ],
  },
  {
    key: "uw_inner_land_mines",
    title: "UW — Inner Land Mines",
    fields: [
      { key: "damage", label: "Damage", type: "number", unit: "pct" },
      { key: "mine_count", label: "Mine Count", type: "int" },
      { key: "blast_radius", label: "Blast Radius", type: "int" },
      { key: "rotation_speed", label: "Rotation Speed", type: "int" },
      { key: "stun", label: "Stun", type: "int" },
      { key: "cooldown", label: "Cooldown", type: "number", unit: "sec" },
    ],
  },
  {
    key: "uw_chrono_field",
    title: "UW — Chrono Field",
    fields: [
      { key: "speed_reduction", label: "Speed Reduction", type: "number", unit: "pct" },
      { key: "damage_reduction", label: "Damage Reduction", type: "number", unit: "pct" },
      { key: "range", label: "Range", type: "int" },
      { key: "duration", label: "Duration", type: "number", unit: "sec" },
      { key: "cooldown", label: "Cooldown", type: "number", unit: "sec" },
    ],
  },
  {
    key: "modules",
    title: "Modules",
    fields: [
      ...modFields("cannon", "Cannon"),
      ...modFields("armor", "Armor"),
      ...modFields("generator", "Generator"),
      ...modFields("core", "Core"),
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
