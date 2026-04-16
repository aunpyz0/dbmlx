import type { QualifiedName, Ref } from '../../shared/types';
import { estimateSize } from '../layout/autoLayout';
import { routeRefs } from './edgeRouter';
import type { Bbox } from './spatialIndex';

interface GroupSize {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface EdgeLayerProps {
  refs: Ref[];
  positions: Map<QualifiedName, { x: number; y: number }>;
  columnCountByTable: Map<QualifiedName, number>;
  groupSizes?: GroupSize[];
}

const GROUP_PREFIX = '__group__:';

export function EdgeLayer({ refs, positions, columnCountByTable, groupSizes }: EdgeLayerProps) {
  const groupByName = new Map<string, GroupSize>();
  if (groupSizes) {
    for (const g of groupSizes) groupByName.set(g.name, g);
  }

  const bboxOf = (name: QualifiedName): Bbox | undefined => {
    if (name.startsWith(GROUP_PREFIX)) {
      const groupName = name.slice(GROUP_PREFIX.length);
      const g = groupByName.get(groupName);
      if (!g) return undefined;
      return { x: g.x, y: g.y, w: g.w, h: g.h };
    }
    const pos = positions.get(name);
    if (!pos) return undefined;
    const size = estimateSize(columnCountByTable.get(name) ?? 0);
    return { x: pos.x, y: pos.y, w: size.width, h: size.height };
  };
  const routes = routeRefs(refs, bboxOf);

  const refById = new Map<string, Ref>();
  for (const r of refs) refById.set(r.id, r);

  return (
    <svg
      class="ddd-edges"
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
      width="100%"
      height="100%"
    >
      <defs>
        <marker id="ddd-mk-many" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto">
          <path d="M2,2 L10,6 L2,10 M10,2 L10,10" fill="none" stroke="currentColor" stroke-width="1.2" />
        </marker>
        <marker id="ddd-mk-one" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto">
          <path d="M10,2 L10,10" fill="none" stroke="currentColor" stroke-width="1.4" />
        </marker>
        <marker id="ddd-mk-many-s" viewBox="0 0 12 12" refX="2" refY="6" markerWidth="10" markerHeight="10" orient="auto">
          <path d="M10,2 L2,6 L10,10 M2,2 L2,10" fill="none" stroke="currentColor" stroke-width="1.2" />
        </marker>
        <marker id="ddd-mk-one-s" viewBox="0 0 12 12" refX="2" refY="6" markerWidth="10" markerHeight="10" orient="auto">
          <path d="M2,2 L2,10" fill="none" stroke="currentColor" stroke-width="1.4" />
        </marker>
      </defs>
      {routes.map((r) => {
        const ref = refById.get(r.id);
        const startMarker = ref?.source.relation === '*' ? 'url(#ddd-mk-many-s)' : 'url(#ddd-mk-one-s)';
        const endMarker   = ref?.target.relation === '*' ? 'url(#ddd-mk-many)'   : 'url(#ddd-mk-one)';
        return (
          <path
            key={r.id}
            d={r.d}
            class="ddd-edge"
            marker-start={startMarker}
            marker-end={endMarker}
          />
        );
      })}
    </svg>
  );
}
