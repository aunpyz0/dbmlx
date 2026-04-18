import { store, useAppStore } from '../state/store';
import { postToHost } from '../vscode';

export function ViewPanel() {
  const views = useAppStore((s) => s.schema.views);
  const activeView = useAppStore((s) => s.activeView);

  if (views.length === 0) return null;

  return (
    <div class="ddd-view-panel">
      <div class="ddd-view-panel__title">Views</div>
      <button
        class={`ddd-view-item ${activeView === null ? 'is-active' : ''}`}
        onClick={() => { store.getState().setActiveView(null); postToHost({ type: 'view:switch', payload: { view: null } }); }}
      >
        All tables
      </button>
      {views.map((v) => (
        <button
          key={v.name}
          class={`ddd-view-item ${activeView === v.name ? 'is-active' : ''}`}
          onClick={() => { const next = activeView === v.name ? null : v.name; store.getState().setActiveView(next); postToHost({ type: 'view:switch', payload: { view: next } }); }}
          title={v.name}
        >
          {v.name}
        </button>
      ))}
    </div>
  );
}
