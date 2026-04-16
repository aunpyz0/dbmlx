import { useState } from 'preact/hooks';
import type { TableGroup } from '../../shared/types';
import { store, useAppStore } from '../state/store';
import { schedulePersist } from '../drag/dragController';

export function GroupPanel() {
  const groups = useAppStore((s) => s.schema.groups);
  const groupState = useAppStore((s) => s.groups);
  const hiddenTables = useAppStore((s) => s.hiddenTables);
  const [open, setOpen] = useState(true);

  if (groups.length === 0) return null;

  return (
    <div class={`ddd-group-panel ${open ? 'is-open' : 'is-closed'}`}>
      <button class="ddd-group-panel__toggle" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} Groups ({groups.length})
      </button>
      {open ? (
        <ul class="ddd-group-list">
          {groups.map((g) => (
            <GroupRow
              key={g.name}
              group={g}
              state={groupState[g.name]}
              hiddenTables={hiddenTables}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

interface GroupRowProps {
  group: TableGroup;
  state: { collapsed?: boolean; hidden?: boolean; color?: string } | undefined;
  hiddenTables: Set<string>;
}

function GroupRow({ group, state, hiddenTables }: GroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hidden = state?.hidden ?? false;
  const collapsed = state?.collapsed ?? false;
  const color = state?.color ?? colorForGroup(group.name);

  const toggleHidden = () => {
    store.getState().setGroup(group.name, { hidden: !hidden });
    schedulePersist();
  };
  const toggleCollapsed = () => {
    store.getState().setGroup(group.name, { collapsed: !collapsed });
    schedulePersist();
  };

  return (
    <>
      <li class="ddd-group-row">
        <button
          class="ddd-group-chevron"
          onClick={() => setExpanded(!expanded)}
          title={expanded ? 'Collapse list' : 'Expand table list'}
        >{expanded ? '▾' : '▸'}</button>
        <span class="ddd-group-swatch" style={{ background: color }} title={color} />
        <span class="ddd-group-name" title={`${group.tables.length} tables`}>{group.name}</span>
        <span class="ddd-group-count">{group.tables.length}</span>
        <button
          class={`ddd-group-btn ${hidden ? 'is-off' : 'is-on'}`}
          onClick={toggleHidden}
          title={hidden ? 'Show group' : 'Hide group'}
        >{hidden ? '◌' : '●'}</button>
        <button
          class={`ddd-group-btn ${collapsed ? 'is-on' : ''}`}
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand group' : 'Collapse group'}
        >{collapsed ? '□' : '▦'}</button>
      </li>
      {expanded ? (
        <li class="ddd-group-children">
          <ul class="ddd-table-list">
            {group.tables.map((name) => (
              <TableRow key={name} tableName={name} hidden={hiddenTables.has(name)} />
            ))}
          </ul>
        </li>
      ) : null}
    </>
  );
}

function TableRow({ tableName, hidden }: { tableName: string; hidden: boolean }) {
  const shortName = tableName.startsWith('public.') ? tableName.slice(7) : tableName;
  const toggle = () => {
    store.getState().setTableHidden(tableName, !hidden);
    schedulePersist();
  };
  return (
    <li class="ddd-table-row">
      <span class="ddd-table-row__name" title={tableName}>{shortName}</span>
      <button
        class={`ddd-group-btn ${hidden ? 'is-off' : 'is-on'}`}
        onClick={toggle}
        title={hidden ? 'Show table' : 'Hide table'}
      >{hidden ? '◌' : '●'}</button>
    </li>
  );
}

export function colorForGroup(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 55%, 60%)`;
}
