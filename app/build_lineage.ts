// build_lineage.ts — pure grouping of build snapshots into "lines".
//
// Every build carries a parent_build_id, so leveling/respeccing forms a chain:
// a "line" is all snapshots sharing a root ancestor. The builds list shows one
// row per line (its newest snapshot = the current "head"), instead of a flood of
// near-identical rows, while every past run still points at the exact snapshot
// it ran with. Version numbers run oldest→newest within a line (root = v1).
// No I/O, no imports — pure and unit-tested.

export interface BuildNode {
  id: number;
  label: string;
  parent_build_id: number | null;
  created_at: string;
}

export interface LineSnapshot extends BuildNode {
  version: number; // 1-based position in the line (oldest = 1)
}

export interface BuildLine {
  rootId: number;
  head: LineSnapshot; // newest snapshot — the current build for this line
  count: number;
  snapshots: LineSnapshot[]; // newest-first (head is [0])
}

const ts = (s: string): number => {
  const n = Date.parse(s);
  return Number.isFinite(n) ? n : 0;
};

// The root ancestor of a node: walk parent_build_id up until it's null or points
// outside the given set (e.g. an older build beyond the list cap). Memoized.
function rootIdOf(
  start: BuildNode,
  byId: Map<number, BuildNode>,
  memo: Map<number, number>,
): number {
  const seen: number[] = [];
  let cur: BuildNode = start;
  while (true) {
    const cached = memo.get(cur.id);
    if (cached !== undefined) {
      for (const s of seen) memo.set(s, cached);
      return cached;
    }
    seen.push(cur.id);
    const parent = cur.parent_build_id != null ? byId.get(cur.parent_build_id) : undefined;
    if (!parent || parent.id === cur.id) {
      for (const s of seen) memo.set(s, cur.id);
      return cur.id;
    }
    cur = parent;
  }
}

// Group builds into lines, newest-active line first. Each line's snapshots are
// versioned oldest→newest and returned newest-first.
export function buildLines(builds: BuildNode[]): BuildLine[] {
  const byId = new Map(builds.map((b) => [b.id, b]));
  const memo = new Map<number, number>();
  const groups = new Map<number, BuildNode[]>();
  for (const b of builds) {
    const root = rootIdOf(b, byId, memo);
    (groups.get(root) ?? groups.set(root, []).get(root)!).push(b);
  }
  const lines: BuildLine[] = [];
  for (const [rootId, nodes] of groups) {
    const asc = [...nodes].sort((a, b) => ts(a.created_at) - ts(b.created_at) || a.id - b.id);
    const newestFirst: LineSnapshot[] = asc
      .map((n, i) => ({ ...n, version: i + 1 }))
      .reverse();
    lines.push({ rootId, head: newestFirst[0], count: newestFirst.length, snapshots: newestFirst });
  }
  lines.sort((a, b) => ts(b.head.created_at) - ts(a.head.created_at) || b.head.id - a.head.id);
  return lines;
}

// The line that contains a given build id (for the build-detail history panel).
export function lineContaining(builds: BuildNode[], id: number): BuildLine | undefined {
  return buildLines(builds).find((l) => l.snapshots.some((s) => s.id === id));
}
