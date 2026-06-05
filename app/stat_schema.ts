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

export type FieldType = "int" | "number" | "text" | "bool" | "select";

export interface Enhancement {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
}

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  enhancement?: Enhancement;
}

export interface Category {
  key: string;
  title: string;
  fields: Field[];
}

const RARITY = ["Common", "Rare", "Epic", "Legendary", "Mythic", "Ancestral"];

// Shorthand for the common int enhancement (all enhancements are multipliers).
const enh = (key: string, label: string): Enhancement => ({ key, label, type: "int" });

export const STAT_SCHEMA: Category[] = [
  {
    key: "workshop_attack",
    title: "Workshop — Attack",
    fields: [
      { key: "damage",            label: "Damage",              type: "int", enhancement: enh("damage_enh",           "Damage ×") },
      { key: "attack_speed",      label: "Attack Speed",        type: "int", enhancement: enh("attack_speed_enh",     "Attack Speed ×") },
      { key: "crit_chance",       label: "Crit Chance",         type: "int" },
      { key: "crit_factor",       label: "Crit Factor",         type: "int", enhancement: enh("crit_factor_enh",      "Crit Factor ×") },
      { key: "range",             label: "Range",               type: "int" },
      { key: "damage_per_meter",  label: "Damage / Meter",      type: "int", enhancement: enh("damage_per_meter_enh", "Damage / Meter ×") },
      { key: "multishot_chance",  label: "Multishot Chance",    type: "int" },
      { key: "multishot_targets", label: "Multishot Targets",   type: "int" },
      { key: "rapid_fire_chance", label: "Rapid Fire Chance",   type: "int" },
      { key: "rapid_fire_dur",    label: "Rapid Fire Duration", type: "int" },
      { key: "bounce_chance",     label: "Bounce Shot Chance",  type: "int" },
      { key: "bounce_targets",    label: "Bounce Shot Targets", type: "int" },
      { key: "bounce_range",      label: "Bounce Shot Range",   type: "int" },
      { key: "super_crit_chance", label: "Super Crit Chance",   type: "int" },
      { key: "super_crit_multi",  label: "Super Crit Multi",    type: "int", enhancement: enh("super_crit_multi_enh", "Super Crit Multi ×") },
      { key: "rend_chance",       label: "Rend Armor Chance",   type: "int", enhancement: enh("rend_enh",             "Rend Armor ×") },
      { key: "rend_mult",         label: "Rend Armor Mult",     type: "int" },
    ],
  },
  {
    key: "workshop_defense",
    title: "Workshop — Defense",
    fields: [
      { key: "health",           label: "Health",              type: "int", enhancement: enh("health_enh",           "Health ×") },
      { key: "health_regen",     label: "Health Regen",        type: "int", enhancement: enh("health_regen_enh",     "Health Regen ×") },
      { key: "defense_percent",  label: "Defense %",           type: "int" },
      { key: "defense_absolute", label: "Defense Absolute",    type: "int", enhancement: enh("defense_absolute_enh", "Defense Absolute ×") },
      { key: "thorns",           label: "Thorn Damage",        type: "int" },
      { key: "lifesteal",        label: "Lifesteal",           type: "int" },
      { key: "knockback_chance", label: "Knockback Chance",    type: "int" },
      { key: "knockback_force",  label: "Knockback Force",     type: "int" },
      { key: "orbs",             label: "Orbs",                type: "int", enhancement: enh("orb_size_enh",         "Orb Size ×") },
      { key: "orb_speed",        label: "Orb Speed",           type: "int" },
      { key: "shockwave_size",   label: "Shockwave Size",      type: "int" },
      { key: "shockwave_freq",   label: "Shockwave Frequency", type: "int" },
      { key: "land_mine_chance", label: "Land Mine Chance",    type: "int" },
      { key: "land_mine_damage", label: "Land Mine Damage",    type: "int", enhancement: enh("land_mine_damage_enh", "Land Mine Damage ×") },
      { key: "land_mine_radius", label: "Land Mine Radius",    type: "int" },
      { key: "death_defy",       label: "Death Defy",          type: "int" },
      { key: "wall_health",      label: "Wall Health",         type: "int", enhancement: enh("wall_health_enh",      "Wall Health ×") },
      { key: "wall_rebuild",     label: "Wall Rebuild",        type: "int" },
    ],
  },
  {
    key: "workshop_utility",
    title: "Workshop — Utility",
    fields: [
      { key: "cash_bonus",             label: "Cash Bonus",                   type: "int", enhancement: enh("cash_bonus_enh",    "Cash Bonus ×") },
      { key: "cash_wave",              label: "Cash / Wave",                  type: "int" },
      { key: "coins_per_kill",         label: "Coins / Kill",                 type: "int", enhancement: enh("coin_bonus_enh",    "Coin Bonus ×") },
      { key: "coins_wave",             label: "Coins / Wave",                 type: "int" },
      { key: "interest",               label: "Interest",                     type: "int" },
      { key: "recovery_amount",        label: "Recovery Amount",              type: "int", enhancement: enh("packages_enh",      "Packages ×") },
      { key: "free_attack",            label: "Free Attack Upgrades",         type: "int", enhancement: enh("free_upgrades_enh", "Free Upgrades ×") },
      { key: "free_defense",           label: "Free Defense Upgrades",        type: "int" },
      { key: "free_utility",           label: "Free Utility Upgrades",        type: "int" },
      { key: "cells_kill_bonus",       label: "Cells / Kill Bonus (Enh)",     type: "int" },
      { key: "enemy_atk_level_skips",  label: "Enemy Atk Level Skips (Enh)", type: "int" },
      { key: "enemy_hp_level_skips",   label: "Enemy HP Level Skips (Enh)",  type: "int" },
    ],
  },
  {
    key: "ultimate_weapons",
    title: "Ultimate Weapons (level, 0 = locked)",
    fields: [
      { key: "golden_tower",    label: "Golden Tower",    type: "int" },
      { key: "black_hole",      label: "Black Hole",      type: "int" },
      { key: "death_wave",      label: "Death Wave",      type: "int" },
      { key: "spotlight",       label: "Spotlight",       type: "int" },
      { key: "chain_lightning", label: "Chain Lightning", type: "int" },
      { key: "smart_missiles",  label: "Smart Missiles",  type: "int" },
    ],
  },
  {
    key: "modules",
    title: "Modules",
    fields: [
      { key: "cannon_name",     label: "Cannon — Name",     type: "text" },
      { key: "cannon_rarity",   label: "Cannon — Rarity",   type: "select", options: RARITY },
      { key: "cannon_level",    label: "Cannon — Level",    type: "int" },
      { key: "armor_name",      label: "Armor — Name",      type: "text" },
      { key: "armor_rarity",    label: "Armor — Rarity",    type: "select", options: RARITY },
      { key: "armor_level",     label: "Armor — Level",     type: "int" },
      { key: "generator_name",   label: "Generator — Name",   type: "text" },
      { key: "generator_rarity", label: "Generator — Rarity", type: "select", options: RARITY },
      { key: "generator_level",  label: "Generator — Level",  type: "int" },
      { key: "core_name",        label: "Core — Name",        type: "text" },
      { key: "core_rarity",      label: "Core — Rarity",      type: "select", options: RARITY },
      { key: "core_level",       label: "Core — Level",       type: "int" },
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
