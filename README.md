# DBMLX: Database Visual and Design

**DBMLX** (`.dbmlx`) is a VSCode extension for designing, visualizing, and managing database schemas as interactive diagrams. It introduces **Database Markup Language Extension** — a superset of the DBML format with first-class support for multi-file projects, DDD bounded contexts, custom diagram views, and migration diff annotations.

Your schema stays in plain text. The extension reads it, renders it, and persists your layout alongside it — reviewable in Git, portable across teams.

> **Forked from** [TWulfZ/dddbml](https://github.com/TWulfZ/dddbml) — extended with LSP intelligence, migration diff visualization, custom syntax, and a standalone export engine.
> Uses [`@dbml/core`](https://github.com/holistics/dbml) (Apache-2.0) as the underlying parser.

→ **[Full language reference](docs/language-reference.md)** — complete syntax, all constructs, migration diffs, DiagramView, layout format.

---

## Install

From the VSCode Marketplace *(coming soon)*, or from a VSIX:

```bash
code --install-extension dbmlx-0.1.2.vsix
```

Open any `.dbmlx` file, then run **`DBMLX: Open Diagram`** from the command palette, or click the icon in the editor title bar.

---

## The .dbmlx Language

`.dbmlx` is a superset of standard DBML. All valid DBML is valid `.dbmlx`. On top of that, dbmlx adds:

### `!include` — multi-file schemas

Split large schemas across files. The extension stitches them before parsing.

```dbmlx
!include "auth/users.dbmlx"
!include "billing/invoices.dbmlx"

Ref: users.id < invoices.user_id
```

### `DiagramView` — named filtered views

Define multiple views of the same schema without duplicating anything.

```dbmlx
DiagramView auth_context {
  TableGroups { auth }
}

DiagramView billing_overview {
  Tables { orders, invoices, payments }
}
```

### Migration diff annotations

Annotate columns with `[add]`, `[drop]`, or `[modify: name="x" type="y"]` to visualize schema changes as a before/after diff directly in the diagram.

```dbmlx
Table orders {
  id         int    [pk]
  status     varchar(50)
  amount     decimal(10,2) [add]
  total      decimal       [drop]
  customer   varchar(100)  [modify: name="customer_id" type="int"]
}
```

---

## Features

### Interactive diagram

- Every `Table`, `Ref`, and `TableGroup` renders as positioned nodes with Manhattan-routed edges.
- Each FK edge exits from the **source column row** and enters at the **target column row** — not the table midpoint.
- **Drag** tables freely. Positions are saved to a sidecar `.dbmlx.layout.json` after a 300ms debounce.
- **Multi-select**: click-drag on empty space for marquee. `Shift`+marquee extends selection. Drag any selected table to move the group.
- **Drag the middle segment** of any edge to reroute it. The offset persists in the layout file.
- Cardinality markers: crow's-foot for many (`*`), bar for one (`1`).

### DDD-aware bounded contexts

- Every `TableGroup` becomes a collapsible bounded context panel.
- **Collapse** a group to a single summary node — edges route to/from it.
- **Hide** a group to remove it and all its edges from the diagram.
- Assign custom colors per group or per table via the gear menu.

### Diagram Views

Switch between named views from the sidebar panel. Each view filters tables, groups, and schemas independently. Great for presenting subsystems of large schemas without editing the source.

### Layout persistence

Positions, viewport, group state, and edge offsets live in `schema.dbmlx.layout.json` next to your schema:

```json
{
  "version": 1,
  "viewport": { "x": 0, "y": 0, "zoom": 1.0 },
  "tables": { "public.users": { "x": 120, "y": 80 } },
  "groups": { "billing": { "collapsed": true, "color": "#D0E8FF" } }
}
```

Keys are alphabetically sorted, integers for coordinates, defaults omitted — **minimal, reviewable Git diffs**.

### Performance

- Spatial index + viewport culling: only visible tables render.
- LOD rendering: full detail at ≥60% zoom, header-only at 30–60%, bounding box below 30%.
- Targets **60fps pan/zoom with 5000+ tables**.

### LSP intelligence

Full language server features for `.dbmlx` files:

| Feature | Details |
|---|---|
| **Hover** | Table schema, column types/constraints; keyword docs for every construct |
| **Go-to-definition** | Jump to table definition; `!include` → open included file |
| **Document symbols** | Outline panel lists all tables and columns |
| **Completions** | Table names, column names, SQL types, settings, ref operators, `!include` file paths |
| **Formatting** | Auto-format on save — consistent indentation and spacing |
| **Diagnostics** | Parse errors shown as squiggles with line/column |

### Export

- **SVG**: full fidelity — tables, edges, markers, cardinality labels, group containers, migration diff colors.
- **PNG**: rasterized from SVG via canvas.

Run **`DBMLX: Export Diagram as SVG`** from the command palette, or use the export buttons in the diagram toolbar.

---

## Commands

| Command | Default Shortcut |
|---|---|
| DBMLX: Open Diagram | — |
| DBMLX: Auto Re-arrange Diagram | — |
| DBMLX: Fit to Content | `Ctrl+1` / `Cmd+1` |
| DBMLX: Reset View | `Ctrl+0` / `Cmd+0` |
| DBMLX: Zoom In | `Ctrl+=` / `Cmd+=` |
| DBMLX: Zoom Out | `Ctrl+-` / `Cmd+-` |
| DBMLX: Export Diagram as SVG | — |

---

## Layout file

The sidecar `schema.dbmlx.layout.json` is intentionally human-readable and Git-friendly:

- **Stable key ordering** — no noisy diffs when positions don't change.
- **Integers only** for coordinates — no floating-point drift.
- **Defaults omitted** — `collapsed: false` and `hidden: false` are not written.
- **Atomic writes** — tmp file → rename, no partial writes.

Commit this file alongside your schema. Your team sees the same diagram layout on checkout.

---

## Credits

- Forked from [TWulfZ/dddbml](https://github.com/TWulfZ/dddbml) — original Git-friendly DBML diagram renderer.
- DBML language and `@dbml/core` parser by [Holistics](https://github.com/holistics/dbml) (Apache-2.0).
- Layout engine: [`@dagrejs/dagre`](https://github.com/dagrejs/dagre).
- Rendered with [Preact](https://preactjs.com/) + [Zustand](https://zustand-demo.pmnd.rs/).
