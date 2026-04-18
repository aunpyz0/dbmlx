import * as dagre from '@dagrejs/dagre';
import type { QualifiedName, Ref, Table } from '../../shared/types';

export interface NodeSize {
  width: number;
  height: number;
}

export type LayoutAlgorithm = 'top-down' | 'left-right' | 'snowflake' | 'compact';

/**
 * Runs the chosen layout algorithm over the given tables.
 * Returns a Map of table name → top-left position.
 * Call only when needed (e.g., tables with no layout entry), NOT on every re-render.
 */
export function autoLayout(
  tables: Table[],
  refs: Ref[],
  sizeOf: (name: QualifiedName) => NodeSize,
  algorithm: LayoutAlgorithm = 'top-down',
  groupAware = false,
): Map<QualifiedName, { x: number; y: number }> {
  if (tables.length === 0) return new Map();
  switch (algorithm) {
    case 'left-right': return runDagre(tables, refs, sizeOf, 'LR', groupAware);
    case 'snowflake': return runSnowflake(tables, refs, sizeOf, groupAware);
    case 'compact': return runCompact(tables, sizeOf, groupAware);
    default: return runDagre(tables, refs, sizeOf, 'TB', groupAware);
  }
}

interface DagreNode { x: number; y: number; width: number; height: number; }

function runDagre(
  tables: Table[],
  refs: Ref[],
  sizeOf: (name: QualifiedName) => NodeSize,
  rankdir: 'TB' | 'LR',
  groupAware: boolean,
): Map<QualifiedName, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph({ multigraph: true, compound: groupAware });
  g.setGraph({ rankdir, nodesep: 48, ranksep: 96, marginx: 32, marginy: 32 });
  g.setDefaultEdgeLabel(() => ({}));

  if (groupAware) {
    const groupNames = new Set<string>();
    for (const t of tables) if (t.groupName) groupNames.add(t.groupName);
    for (const gName of groupNames) g.setNode(`__grp__:${gName}`, {});
  }

  for (const t of tables) {
    const size = sizeOf(t.name);
    g.setNode(t.name, { width: size.width, height: size.height });
    if (groupAware && t.groupName) g.setParent(t.name, `__grp__:${t.groupName}`);
  }
  for (const r of refs) {
    if (!g.hasNode(r.source.table) || !g.hasNode(r.target.table)) continue;
    g.setEdge(r.source.table, r.target.table, { weight: 1 }, r.id);
  }
  dagre.layout(g);
  const out = new Map<QualifiedName, { x: number; y: number }>();
  for (const t of tables) {
    const node = g.node(t.name) as DagreNode | undefined;
    if (node && typeof node.x === 'number' && typeof node.y === 'number') {
      out.set(t.name, { x: Math.round(node.x - node.width / 2), y: Math.round(node.y - node.height / 2) });
    }
  }
  return out;
}

/** Radial layout: most-connected tables (or groups) near center, BFS rings expanding outward. */
function runSnowflake(
  tables: Table[],
  refs: Ref[],
  sizeOf: (name: QualifiedName) => NodeSize,
  groupAware: boolean,
): Map<QualifiedName, { x: number; y: number }> {
  const superOf = (t: Table) => (groupAware && t.groupName) ? `__grp__:${t.groupName}` : t.name;

  // Build adjacency between super-nodes
  const superAdj = new Map<string, Set<string>>();
  for (const t of tables) {
    const s = superOf(t);
    if (!superAdj.has(s)) superAdj.set(s, new Set());
  }
  for (const r of refs) {
    const src = tables.find((t) => t.name === r.source.table);
    const tgt = tables.find((t) => t.name === r.target.table);
    if (!src || !tgt) continue;
    const ss = superOf(src);
    const st = superOf(tgt);
    if (ss === st) continue;
    superAdj.get(ss)?.add(st);
    superAdj.get(st)?.add(ss);
  }

  const superDegree = (s: string) => superAdj.get(s)?.size ?? 0;
  const sortedSupers = [...superAdj.keys()].sort((a, b) => superDegree(b) - superDegree(a));

  if (superDegree(sortedSupers[0]!) === 0) return runCompact(tables, sizeOf, groupAware);

  // BFS on super-nodes
  const visited = new Set<string>();
  const levels: string[][] = [];
  let frontier = [sortedSupers[0]!];
  visited.add(sortedSupers[0]!);

  while (frontier.length > 0) {
    levels.push(frontier);
    const next: string[] = [];
    for (const s of frontier) {
      for (const nb of superAdj.get(s) ?? []) {
        if (!visited.has(nb)) { visited.add(nb); next.push(nb); }
      }
    }
    frontier = next;
  }

  const RING_STEP = groupAware ? 500 : 380;
  const superPos = new Map<string, { cx: number; cy: number }>();

  for (const [li, level] of levels.entries()) {
    if (li === 0) {
      superPos.set(level[0]!, { cx: 0, cy: 0 });
    } else {
      const radius = li * RING_STEP;
      const step = (2 * Math.PI) / level.length;
      for (let i = 0; i < level.length; i++) {
        const angle = i * step - Math.PI / 2;
        superPos.set(level[i]!, {
          cx: Math.round(radius * Math.cos(angle)),
          cy: Math.round(radius * Math.sin(angle)),
        });
      }
    }
  }

  // Isolated super-nodes in a row below
  const isolated = [...superAdj.keys()].filter((s) => !visited.has(s));
  if (isolated.length > 0) {
    const bottomY = levels.length * RING_STEP + 100;
    let cx = 0;
    for (const s of isolated) { superPos.set(s, { cx, cy: bottomY }); cx += 400; }
  }

  // Expand each super-node: single table → place at center; group → mini grid centered at ring pos
  const tablesBySuper = new Map<string, Table[]>();
  for (const t of tables) {
    const s = superOf(t);
    if (!tablesBySuper.has(s)) tablesBySuper.set(s, []);
    tablesBySuper.get(s)!.push(t);
  }

  const out = new Map<QualifiedName, { x: number; y: number }>();
  for (const [s, members] of tablesBySuper) {
    const { cx, cy } = superPos.get(s) ?? { cx: 0, cy: 0 };
    for (const [name, pos] of miniCompactCentered(members, sizeOf, cx, cy)) {
      out.set(name, pos);
    }
  }
  return out;
}

/** Grid layout: tables packed into a square grid, optionally sorted by group. */
function runCompact(
  tables: Table[],
  sizeOf: (name: QualifiedName) => NodeSize,
  groupAware: boolean,
): Map<QualifiedName, { x: number; y: number }> {
  const ordered = groupAware
    ? [...tables].sort((a, b) => {
        const ga = a.groupName ?? '\xff';
        const gb = b.groupName ?? '\xff';
        return ga < gb ? -1 : ga > gb ? 1 : 0;
      })
    : tables;
  const COLS = Math.max(1, Math.ceil(Math.sqrt(ordered.length)));
  const GAP_X = 32;
  const GAP_Y = 48;
  const out = new Map<QualifiedName, { x: number; y: number }>();
  let x = 0, y = 0, col = 0, rowH = 0;
  for (const t of ordered) {
    const sz = sizeOf(t.name);
    out.set(t.name, { x, y });
    rowH = Math.max(rowH, sz.height);
    x += sz.width + GAP_X;
    col++;
    if (col >= COLS) { col = 0; x = 0; y += rowH + GAP_Y; rowH = 0; }
  }
  return out;
}

/** Place members in a mini compact grid, bounding-box-centered at (cx, cy). */
function miniCompactCentered(
  members: Table[],
  sizeOf: (name: QualifiedName) => NodeSize,
  cx: number,
  cy: number,
): Map<QualifiedName, { x: number; y: number }> {
  const COLS = Math.max(1, Math.ceil(Math.sqrt(members.length)));
  const GAP_X = 32, GAP_Y = 48;
  let x = 0, y = 0, col = 0, rowH = 0;
  const rel = new Map<QualifiedName, { x: number; y: number }>();
  for (const t of members) {
    const sz = sizeOf(t.name);
    rel.set(t.name, { x, y });
    rowH = Math.max(rowH, sz.height);
    x += sz.width + GAP_X;
    col++;
    if (col >= COLS) { col = 0; x = 0; y += rowH + GAP_Y; rowH = 0; }
  }
  // Compute bbox width/height
  let maxX = 0, maxY = 0;
  for (const [name, pos] of rel) {
    const sz = sizeOf(name);
    if (pos.x + sz.width > maxX) maxX = pos.x + sz.width;
    if (pos.y + sz.height > maxY) maxY = pos.y + sz.height;
  }
  const offsetX = cx - maxX / 2;
  const offsetY = cy - maxY / 2;
  const out = new Map<QualifiedName, { x: number; y: number }>();
  for (const [name, pos] of rel) {
    out.set(name, { x: Math.round(offsetX + pos.x), y: Math.round(offsetY + pos.y) });
  }
  return out;
}

/** Geometric constants used across router, renderer, and layout. MUST match CSS `.ddd-table__header`, `.ddd-table__col`, `.ddd-table__cols`. */
export const TABLE_HEADER_H = 28;
export const TABLE_ROW_H = 20;
export const TABLE_WIDTH = 240;
export const TABLE_BOTTOM_PAD = 8; // matches .ddd-table__cols padding (4 top + 4 bottom)

/**
 * Estimate node height based on column count. Width fixed.
 */
export function estimateSize(columnCount: number): NodeSize {
  return { width: TABLE_WIDTH, height: TABLE_HEADER_H + columnCount * TABLE_ROW_H + TABLE_BOTTOM_PAD };
}

/** Y offset (from table top) for the vertical center of a column row at `index`. */
export function columnCenterY(index: number): number {
  // 4px top-padding of .ddd-table__cols before rows start.
  return TABLE_HEADER_H + 4 + index * TABLE_ROW_H + TABLE_ROW_H / 2;
}
