// module_catalog.ts — the named-module catalog (pure data).
//
// Each of the 24 "named" modules (Epic and above; 6 per type) has a FIXED type
// and Unique Effect — properties of the module itself, not something the player
// rolls. The build form uses this to auto-fill the unique effect from the chosen
// module name, so the player never hand-types it. `mainEffect` (the stat the
// module's × multiplier applies to) is filled where verified; unknown ones fall
// back to manual entry. Unique-effect text uses the wiki's [x] for the level-
// scaled value. Source: Fandom "Epic Module Unique Effect" (+ in-game screens).
//
// Extend freely as the game adds modules — the form degrades gracefully for any
// module name not found here (no auto-fill, manual entry, exactly as before).

export type ModuleType = "cannon" | "armor" | "generator" | "core";

export interface ModuleDef {
  name: string;
  type: ModuleType;
  mainEffect?: string; // the stat the module's main × multiplier boosts
  unique: string; // unique effect text; [x] = level-scaled value
}

export const MODULE_CATALOG: ModuleDef[] = [
  // ---- Cannon ----
  {
    name: "Astral Deliverance",
    type: "cannon",
    unique:
      "Bounce shot's range is increased by 3% of the tower's total range. Each bounce increases the projectile's damage by [x]%",
  },
  {
    name: "Being Annihilator",
    type: "cannon",
    unique: "When you super crit, your next [x] attacks are guaranteed super crits.",
  },
  {
    name: "Death Penalty",
    type: "cannon",
    unique:
      "Chance of [x]% to mark an enemy for death when it spawns, causing the first hit to destroy it.",
  },
  {
    name: "Havoc Bringer",
    type: "cannon",
    unique: "[x]% chance for rend armor to instantly go to max.",
  },
  {
    name: "Shrink Ray",
    type: "cannon",
    unique:
      "Attacks have a 1% chance to apply a non-stacking effect that decreases the enemy's mass by [x]%",
  },
  {
    name: "Amplifying Strike",
    type: "cannon",
    mainEffect: "Tower Damage",
    unique: "Killing a boss or elite enemy increases Tower Damage by 5x for [x]s",
  },
  // ---- Armor ----
  {
    name: "Anti-Cube Portal",
    type: "armor",
    unique: "Enemies take [x]x damage for 7s after they are hit by a shockwave.",
  },
  {
    name: "Negative Mass Projector",
    type: "armor",
    unique:
      "If an orb doesn't kill the enemy it will apply a stacking debuff, reducing its damage and speed by [x]%",
  },
  {
    name: "Wormhole Redirector",
    type: "armor",
    unique: "Health Regen can heal up to [x]% of Package Max Recovery",
  },
  {
    name: "Space Displacer",
    type: "armor",
    unique: "Landmines have a [x]% chance to spawn as an Inner Land Mine (20 max)",
  },
  {
    name: "Sharp Fortitude",
    type: "armor",
    mainEffect: "Tower Health",
    unique:
      "Increase the Wall's health and regen by x[x]. Enemies take +1% increased damage from wall thorns",
  },
  {
    name: "Orbital Augment",
    type: "armor",
    unique:
      "Adds [x] orbiting Electrons around the tower. Each Electron deals damage equal to 15% of enemy's remaining health",
  },
  // ---- Generator ----
  {
    name: "Singularity Harness",
    type: "generator",
    unique:
      "Increase the range of each bot by +[x]m. Enemies hit by the Flame Bot receive double damage.",
  },
  {
    name: "Galaxy Compressor",
    type: "generator",
    mainEffect: "Coin Bonus",
    unique:
      "Collecting a recovery package reduces the cooldown of all Ultimate Weapons except Poison Swamp by [x]s.",
  },
  {
    name: "Pulsar Harvester",
    type: "generator",
    unique:
      "Each time a projectile hits an enemy, there is a [x]% chance that it will reduce the enemy's Health and Attack level by 1",
  },
  {
    name: "Black Hole Digestor",
    type: "generator",
    unique:
      "Temporarily get [x]% extra Coins/Kill Bonus for each free upgrade you got on the current wave.",
  },
  {
    name: "Project Funding",
    type: "generator",
    unique: "Tower damage is multiplied by [x]% of the number of digits in your current cash",
  },
  {
    name: "Restorative Bonus",
    type: "generator",
    unique: "Packages grant a 50% attack speed boost for [x]s, decaying for 60 seconds.",
  },
  // ---- Core ----
  {
    name: "Om Chip",
    type: "core",
    unique:
      "Spotlight will rotate to focus a boss. Bosses reflect the light around it to nearby enemies, increasing by x[x]",
  },
  {
    name: "Harmony Conductor",
    type: "core",
    unique: "[x]% chance of poisoned enemies to miss-attack (bosses chance is halved).",
  },
  {
    name: "Dimension Core",
    type: "core",
    unique:
      "Chain lightning have 60% chance of hitting the initial target. Shock chance and multiplier is doubled.",
  },
  {
    name: "Multiverse Nexus",
    type: "core",
    unique:
      "Death Wave, Golden Tower and Black Hole will always activate at the same time, but the cooldown will be average +/-[x]s.",
  },
  {
    name: "Magnetic Hook",
    type: "core",
    unique:
      "[x] Inner Land Mines are fired at Bosses as they enter Tower range. 25% of Elites have Inner Land Mines fired at them.",
  },
  {
    name: "Primordial Collapse",
    type: "core",
    mainEffect: "Ultimate Weapon Damage",
    unique:
      "Spawns one additional Black Hole. Damage from enemies within a Black Hole is decreased by [x]%",
  },
];

// Modules of a given type, in catalog order (for datalist suggestions).
export function modulesByType(type: ModuleType): ModuleDef[] {
  return MODULE_CATALOG.filter((m) => m.type === type);
}

// Look up a module by exact (case-insensitive, trimmed) name. Returns undefined
// for a custom/unknown name so callers fall back to manual entry.
export function findModule(name: string | null | undefined): ModuleDef | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return MODULE_CATALOG.find((m) => m.name.toLowerCase() === n);
}
