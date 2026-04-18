import { useState } from 'preact/hooks';
import { store, useAppStore } from '../state/store';
import { IconChevronDown, IconChevronUp, IconExport, IconFilter } from '../icons';
import { postToHost } from '../vscode';
import { generateSvg, svgToPngDataUrl } from './exportSvg';

export function ActionsPanel() {
  const [open, setOpen] = useState(false);
  const showOnlyPkFk = useAppStore((s) => s.showOnlyPkFk);

  return (
    <div class={`ddd-actions-panel ${open ? 'is-open' : 'is-closed'}`}>
      <button
        class="ddd-actions-panel__handle"
        onClick={() => setOpen(!open)}
        title={open ? 'Hide actions' : 'Show actions'}
      >
        {open ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
      </button>
      {open ? (
        <div class="ddd-actions-panel__body">
          <button
            class={`ddd-actions-btn ${showOnlyPkFk ? 'is-active' : ''}`}
            onClick={() => store.getState().toggleShowOnlyPkFk()}
            title="Toggle PK/FK-only column view"
          >
            <IconFilter size={12} />
            <span>{showOnlyPkFk ? 'Show all columns' : 'PK/FK only'}</span>
          </button>
          <button
            class="ddd-actions-btn"
            title="Export diagram as SVG"
            onClick={() => {
              const svg = generateSvg(store.getState());
              postToHost({ type: 'export:svg', payload: { svg } });
            }}
          >
            <IconExport size={12} />
            <span>SVG</span>
          </button>
          <button
            class="ddd-actions-btn"
            title="Export diagram as PNG"
            onClick={() => {
              const svg = generateSvg(store.getState());
              svgToPngDataUrl(svg).then((data) => postToHost({ type: 'export:png', payload: { data } }));
            }}
          >
            <IconExport size={12} />
            <span>PNG</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
