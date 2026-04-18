# .dbmlx Language Reference

`.dbmlx` is a superset of [DBML](https://dbml.dbdiagram.io/docs/). Every valid DBML file is valid `.dbmlx`. The extensions add multi-file inclusion, custom diagram views, and migration diff annotations.

---

## Table of Contents

1. [Core DBML Syntax](#1-core-dbml-syntax)
2. [Refs](#2-refs)
3. [Enums](#3-enums)
4. [TableGroups](#4-tablegroups)
5. [Notes](#5-notes)
6. [!include — multi-file schemas](#6-include--multi-file-schemas)
7. [DiagramView — named filtered views](#7-diagramview--named-filtered-views)
8. [Migration diff annotations](#8-migration-diff-annotations)
9. [Layout sidecar file](#9-layout-sidecar-file)

---

## 1. Core DBML Syntax

### Table

```dbmlx
Table schema.table_name [headercolor: "#hex"] {
  column_name  type  [settings]
  ...

  indexes {
    (col1, col2) [name: "idx_name", unique]
    col3         [name: "idx_col3"]
  }

  Note: 'Free-form table description'
}
```

**Schema prefix is optional.** `Table users` is equivalent to `Table public.users`.

### Column settings

| Setting | Meaning |
|---|---|
| `[pk]` | Primary key |
| `[primary key]` | Primary key (long form) |
| `[unique]` | Unique constraint |
| `[not null]` | NOT NULL |
| `[null]` | Nullable (explicit) |
| `[increment]` | Auto-increment / SERIAL |
| `[default: value]` | Default — use `'string'`, `123`, `` `now()` `` for expressions |
| `[ref: > other.id]` | Inline ref (see §2) |
| `[note: 'text']` | Column-level note |

### Common types

`int`, `integer`, `bigint`, `smallint`, `float`, `double`, `decimal(p,s)`,
`boolean`, `bool`, `varchar(n)`, `char(n)`, `text`, `uuid`, `date`, `datetime`,
`timestamp`, `timestamptz`, `json`, `jsonb`, `blob`

Types are passed through to the diagram as-is; any string is accepted.

---

## 2. Refs

Define foreign-key relationships. Can appear at the top level or inside a table.

```dbmlx
// Top-level
Ref ref_name: table_a.col > table_b.col   // many-to-one
Ref: table_a.col < table_b.col            // one-to-many
Ref: table_a.col - table_b.col            // one-to-one
Ref: table_a.col <> table_b.col           // many-to-many

// Composite FK
Ref: orders.(user_id, tenant_id) > users.(id, tenant_id)

// Inline (inside Table block)
Table orders {
  user_id  int  [ref: > users.id]
}
```

| Operator | Meaning |
|---|---|
| `>` | Many-to-one (FK side → PK side) |
| `<` | One-to-many |
| `-` | One-to-one |
| `<>` | Many-to-many |

---

## 3. Enums

```dbmlx
Enum job_status {
  created   [note: 'Newly created']
  running
  done
  failure
}

Table jobs {
  status  job_status
}
```

---

## 4. TableGroups

Groups map to DDD bounded contexts in the diagram. Groups can be collapsed to a single summary node or hidden entirely.

```dbmlx
TableGroup billing {
  orders
  invoices
  payments
}

TableGroup auth {
  users
  sessions
  roles
}
```

Tables inside a group are referenced by their unqualified name. Schema-qualified names (`public.users`) also work.

---

## 5. Notes

```dbmlx
// Table note
Table users {
  Note: 'Stores all registered users'
  id  int  [pk]
  email  varchar(255)  [note: 'Must be unique across tenants']
}

// Project-level note
Project my_project {
  Note: 'Main application schema'
}
```

---

## 6. `!include` — multi-file schemas

Split large schemas across files. Paths are relative to the including file.

```dbmlx
// schema.dbmlx
!include "auth/users.dbmlx"
!include "billing/invoices.dbmlx"
!include "shared/enums.dbmlx"

Ref: users.id < invoices.user_id
```

- Includes are resolved before parsing — the stitched source is passed to the parser as a unit.
- Circular includes are not detected; avoid them.
- Go-to-definition on an `!include` path opens the included file.
- File completion triggers automatically after typing `!include "`.

---

## 7. `DiagramView` — named filtered views

Define multiple views of the same schema. Views filter which tables appear; the underlying schema is unchanged. Each view has its own layout file (see §9).

```dbmlx
DiagramView auth_context {
  Tables { users, sessions, roles }
}

DiagramView billing_overview {
  TableGroups { billing }
}

DiagramView tenant_schema {
  Schemas { tenant }
}

DiagramView everything {
  Tables { * }
}
```

### Sections

| Section | Value | Meaning |
|---|---|---|
| `Tables { ... }` | comma/newline-separated table names | Show only these tables |
| `TableGroups { ... }` | group names | Show all tables belonging to these groups |
| `Schemas { ... }` | schema names (e.g. `public`, `tenant`) | Show all tables in these schemas |

- Multiple sections in one view are **unioned** — a table is shown if it matches any section.
- A view with no sections (or `*` wildcard) shows all tables.
- Views are selected from the **Views** panel in the diagram sidebar.
- Switching views loads a separate layout file automatically.

---

## 8. Migration diff annotations

Annotate columns to visualize a schema migration as a before/after diff in the diagram. The diagram renders `[add]` columns with a green tint and `+` prefix, `[drop]` columns with a red strikethrough, and `[modify:]` columns as a two-row before → after display.

### Syntax

```dbmlx
Table orders {
  id          int           [pk]
  status      varchar(50)
  amount      decimal(10,2) [add]               // new column being added
  total       decimal       [drop]              // column being removed
  customer    varchar(100)  [modify: name="customer_id" type="int"]  // rename + retype
  description text          [not null] [drop]   // [drop] combines with other settings
}
```

### Rules

- `[add]` — column exists in the *after* schema but not the *before*. Rendered in green.
- `[drop]` — column exists in the *before* schema but not the *after*. Rendered in red with strikethrough. The column is still parsed normally by `@dbml/core` (the annotation is stripped before parsing).
- `[modify: name="new_name" type="new_type"]` — column is being renamed and/or retyped. Both `name=` and `type=` are optional; omit whichever is not changing. Rendered as two rows: before (muted, strikethrough) → after (amber).
- Annotations can be combined with standard settings: `[not null] [add]`, `[pk] [drop]`, etc.
- `[add]` and `[drop]` are stripped before passing to the underlying DBML parser, so they never cause parse errors.

---

## 9. Layout sidecar file

The diagram stores table positions, viewport state, group state, and edge offsets in a sidecar JSON file next to the schema.

### File naming

| View | Sidecar file |
|---|---|
| Default (all tables) | `schema.dbmlx.layout.json` |
| Named view `auth_context` | `schema.dbmlx.auth_context.layout.json` |

### Format

```json
{
  "version": 1,
  "viewport": { "x": 0, "y": 0, "zoom": 1.0 },
  "tables": {
    "public.orders": { "x": 120, "y": 80 },
    "public.users":  { "x": 400, "y": 80, "hidden": true, "color": "#D0E8FF" }
  },
  "groups": {
    "billing": { "collapsed": true, "color": "#D0E8FF" },
    "auth":    {}
  },
  "edges": {
    "public.orders(user_id)->public.users(id)": { "dx": 0, "dy": 20 }
  }
}
```

### Properties

**`tables`** — keyed by qualified name `schema.table`:
- `x`, `y` — integer pixel coordinates
- `hidden` — omitted when `false`
- `color` — custom hex color; omitted when default

**`groups`** — keyed by group name:
- `collapsed` — omitted when `false`
- `hidden` — omitted when `false`
- `color` — custom hex color; omitted when default

**`edges`** — keyed by ref ID; values are drag offsets applied to the middle segment:
- `dx`, `dy` — integer pixel deltas; entry omitted when both are zero

Keys are alphabetically sorted at all levels. Coordinates are integers. `false` values and zero edge offsets are omitted — this keeps Git diffs minimal.

Commit this file alongside your schema so teammates see the same diagram on checkout.
