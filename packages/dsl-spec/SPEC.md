# PixelAgent DSL Specification — v0

> Status: **v0 / unstable.** Breaking changes allowed until v1. The DSL is the
> public contract between coding agents, the parser, the renderer, and codegen
> — pick names deliberately because every change ripples downstream.

## 1. Overview

The PixelAgent DSL is a **line-based, declarative description language** for
flat UI screens. Coding agents emit DSL instead of full code; the renderer
turns it into a PNG; codegen turns the approved DSL into React / HTML / SwiftUI.

What it is **not**:

- Not a runtime — there are no expressions, no scripting, no event handlers.
- Not a templating language — no variables, no conditionals (use `STATE` for
  visual variants and `REPEAT` for fixed-count duplication).
- Not a styling language — colors and tokens are inline; theming happens via
  `TOKEN` and theme-aware overrides, not cascade.

Each well-formed DSL document maps to exactly one [`Scene`](./src/index.ts)
value.

## 2. Lexical structure

- **Line-based.** One command per line. No multi-line statements.
- **Comments.** Lines beginning with `#` (after optional leading whitespace)
  are ignored. Trailing comments on the same line as a command are not
  supported in v0.
- **Whitespace.** Indentation is decorative — block structure is defined by
  `END`, not indentation. Multiple spaces between tokens are collapsed.
- **Strings.** Double-quoted: `"Sign in"`. No escape sequences in v0; embed a
  literal `"` by avoiding it in source for now.
- **Params.** `key:value`, **no space around the colon**. Values are bare
  literals (numbers, hex colors, identifiers, enum values) or quoted strings.
- **Token references.** `$<id>` resolves against `Scene.tokens`. The `$`
  prefix is mandatory.
- **Identifiers.** `[a-zA-Z_][a-zA-Z0-9_-]*`. IDs are case-sensitive.
- **Numbers.** Non-negative integers for px values. Decimals reserved for
  future versions; v0 parsers should reject them.
- **Block commands.** `LAYER`, `STACK`, `GRID`, `REPEAT`, `STATE` open a
  block. The block ends with a literal `END` line at the same nesting depth.

## 3. Commands

15 commands across 5 categories. Each section gives the formal signature, a
parameter table, an example, and the validation rules that apply.

Notation: `<required>`, `[optional]`, `name:type` for typed params.

### 3.1 Setup

#### `SCREEN`

Defines the viewport. Must appear exactly once, as the first non-comment line.

```
SCREEN <w:int> <h:int> [theme:light|dark]
```

| Param | Required | Type | Default |
|-------|----------|------|---------|
| w     | yes      | int (px) | — |
| h     | yes      | int (px) | — |
| theme | no       | `light` \| `dark` | `light` |

Example:

```
SCREEN 1440 900 theme:light
```

`theme:dark` sets the canvas default background to `#111827` and the default
foreground to `#E5E7EB`; `theme:light` keeps `#ffffff` / `#111`. Elements that
inherit color (e.g. `BUTTON variant:ghost`) follow the theme foreground. The
renderer and every codegen target must use these same values.

Rules: [`screen-first`](#screen-first).

#### `TOKEN`

Declares a named design token. Tokens are referenced from any color/value
slot via `$id`.

```
TOKEN <id:ident> <value>
```

| Param | Required | Type | Default |
|-------|----------|------|---------|
| id    | yes      | ident | — |
| value | yes      | hex color, int, or string | — |

Example:

```
TOKEN primary #185FA5
TOKEN radius 8
```

Rules: [`id-uniqueness`](#id-uniqueness).

### 3.2 Paint

#### `FILL`

Solid color region. Paint-only, no id (rule [`fill-no-id`](#fill-no-id)).

```
FILL <x:int> <y:int> <w:int> <h:int> <color>
```

Example:

```
FILL 0 0 1440 900 $surface
```

Rules: [`fill-no-id`](#fill-no-id).

#### `RECT`

Rectangle with id. Paint-only — `RECT` never has children
([`rect-no-children`](#rect-no-children)). Use `LAYER` for containers.

```
RECT <id> <x:int> <y:int> <w:int> <h:int> [bg:color] [r:int] [border:width color]
```

| Param  | Required | Type        | Default |
|--------|----------|-------------|---------|
| bg     | no       | color       | none (transparent) |
| r      | no       | int (px)    | `0` |
| border | no       | `<width> <color>` (e.g. `1 #ccc`) | none |

Example:

```
RECT divider 32 280 376 1 bg:#e5e7eb
```

Rules: [`id-uniqueness`](#id-uniqueness), [`rect-no-children`](#rect-no-children),
[`border-inline-only`](#border-inline-only).

#### `TEXT`

Text run.

```
TEXT <id> <x:int> <y:int> "<string>" [size:int] [weight:Weight] [color:color] [align:Align] [max-width:int] [goto:ident]
```

| Param     | Required | Type | Default |
|-----------|----------|------|---------|
| size      | no       | int (px) | `14` |
| weight    | no       | `regular` \| `medium` \| `semibold` \| `bold` | `regular` |
| color     | no       | color | inherit (`#111`) |
| align     | no       | `left` \| `center` \| `right` | `left` |
| max-width | no       | int (px) | unbounded |
| goto      | no       | screen id ([flow link](#flow-links)) | none |

Example:

```
TEXT brand 0 20 "Acme" size:20 weight:semibold align:center max-width:440
```

Rules: [`id-uniqueness`](#id-uniqueness),
[`text-center-needs-maxwidth`](#text-center-needs-maxwidth).

#### `ICON`

Icon glyph. Renderer resolves `name` against an icon set (e.g. Lucide).

```
ICON <id> <x:int> <y:int> "<name>" [size:int] [color:color] [goto:ident]
```

| Param | Required | Type | Default |
|-------|----------|------|---------|
| size  | no       | int (px) | `16` |
| color | no       | color | inherit |
| goto  | no       | screen id ([flow link](#flow-links)) | none |

Example:

```
ICON trend 24 24 "trending-up" size:20 color:$primary
```

Rules: [`id-uniqueness`](#id-uniqueness).

#### `IMAGE`

Bitmap or vector image.

```
IMAGE <id> <x:int> <y:int> <w:int> <h:int> <src:string> [fit:Fit] [r:int] [goto:ident]
```

| Param | Required | Type | Default |
|-------|----------|------|---------|
| fit   | no       | `cover` \| `contain` \| `fill` | `cover` |
| r     | no       | int (px) | `0` |
| goto  | no       | screen id ([flow link](#flow-links)) | none |

Example:

```
IMAGE avatar 32 32 64 64 "avatars/jane.png" fit:cover r:32
```

Rules: [`id-uniqueness`](#id-uniqueness).

### 3.3 Components

#### `INPUT`

Text input field.

```
INPUT <id> <x:int> <y:int> <w:int> <h:int> [type:InputType] [placeholder:string] [label:string] [state:ElementState]
```

| Param       | Required | Type | Default |
|-------------|----------|------|---------|
| type        | no       | `text` \| `email` \| `password` \| `number` \| `tel` \| `url` | `text` |
| placeholder | no       | string | none |
| label       | no       | string | none |
| state       | no       | `default` \| `hover` \| `focus` \| `active` \| `disabled` | `default` |

Example:

```
INPUT email-input 32 80 376 44 type:email label:"Email"
```

Rules: [`id-uniqueness`](#id-uniqueness),
[`input-label-clearance`](#input-label-clearance),
[`tap-target-min-height`](#tap-target-min-height).

#### `BUTTON`

Button.

```
BUTTON <id> <x:int> <y:int> <w:int> <h:int> "<label>" [variant:ButtonVariant] [state:ElementState] [goto:ident]
```

| Param   | Required | Type | Default |
|---------|----------|------|---------|
| variant | no       | `primary` \| `secondary` \| `ghost` \| `destructive` (alias: `danger`) | `primary` |
| state   | no       | `default` \| `hover` \| `focus` \| `active` \| `disabled` | `default` |
| goto    | no       | screen id ([flow link](#flow-links)) | none |

<a id="flow-links"></a>
**Flow links.** `goto:<screen-id>` marks TEXT / ICON / IMAGE / BUTTON as a
link to another screen of a multi-screen preview bundle. It carries **no
logic** — in preview, a click can only reveal a visual state or jump to
another screen, nothing else (Level-2 boundary, see
`docs/vision-changes/2026-06-12-level-2-interactive-preview-semantic-intent.md`).
A `goto` referencing a screen id not present in the bundle yields the
bundle-level warning `goto-unknown-screen`. In single-screen previews and in
the PNG path the param is inert.

Example:

```
BUTTON login-btn 32 224 376 48 "Sign in" variant:primary
```

Rules: [`id-uniqueness`](#id-uniqueness),
[`tap-target-min-height`](#tap-target-min-height).

### 3.4 Layout (block commands)

All three commands open a block that **must** end with a literal `END` line
([`block-end-required`](#block-end-required)).

#### `LAYER`

Group container with explicit positioning. Children inherit positioning from
their own coordinates (relative to the layer).

```
LAYER <id> <x:int> <y:int> <w:int> <h:int> [bg:color] [r:int] [border:width color]
  <child commands>
END
```

Example:

```
LAYER login-card 500 260 440 400 bg:$surface r:12
  TEXT brand 0 20 "Acme" size:20 weight:semibold align:center max-width:440
END
```

Rules: [`id-uniqueness`](#id-uniqueness), [`block-end-required`](#block-end-required),
[`border-inline-only`](#border-inline-only).

#### `STACK`

Auto-layout flex container. Children are positioned automatically along
`direction`, separated by `gap`. The grammar for child commands is unchanged
(positional `x y` are still required), but inside STACK those values **must
be `0 0`** placeholders ([`stack-no-coords`](#stack-no-coords)) — auto-layout
ignores them.

```
STACK <id> <x:int> <y:int> [direction:Direction] [gap:int] [align:Align]
  <child commands with x:0 y:0>
END
```

| Param     | Required | Type | Default |
|-----------|----------|------|---------|
| direction | no       | `row` \| `column` | `column` |
| gap       | no       | int (px) | `0` |
| align     | no       | `left` \| `center` \| `right` | `left` |

Example:

```
STACK metrics 32 32 direction:row gap:16
  RECT cell-1 0 0 120 80 bg:$surface r:8
  RECT cell-2 0 0 120 80 bg:$surface r:8
END
```

See `examples/dashboard-card.dsl` for a fuller usage.

Rules: [`id-uniqueness`](#id-uniqueness), [`block-end-required`](#block-end-required),
[`stack-no-coords`](#stack-no-coords).

#### `GRID`

Column-based grid. Width is fixed; height grows with rows.

```
GRID <id> <x:int> <y:int> <w:int> [columns:int] [gap:int]
  <child commands>
END
```

| Param   | Required | Type | Default |
|---------|----------|------|---------|
| columns | no       | int  | `1` |
| gap     | no       | int (px) | `0` |

Example:

```
GRID gallery 32 32 1376 columns:4 gap:24
  IMAGE g-1 0 0 320 240 "img/1.png"
  IMAGE g-2 0 0 320 240 "img/2.png"
END
```

Rules: [`id-uniqueness`](#id-uniqueness),
[`block-end-required`](#block-end-required).

### 3.5 Meta

#### `STATE`

Visual override applied to `target-id` when it enters `state-name`. The body
is a list of `key: value` overrides (one per line, with a space after the
colon — distinct from inline `key:value` params).

```
STATE <target-id> <state:ElementState>
  <key>: <value>
END
```

Example:

```
STATE login-btn hover
  bg: #0C447C
END
```

Rules: [`block-end-required`](#block-end-required).

#### `REPEAT`

Duplicates a child block `count` times. Children are auto-positioned along
`direction`, like `STACK`.

```
REPEAT <id> <count:int> [direction:Direction] [gap:int]
  <child commands with x:0 y:0>
END
```

Example:

```
REPEAT pills 4 direction:row gap:8
  BUTTON pill-x 0 0 80 32 "Tag" variant:secondary
END
```

Rules: [`id-uniqueness`](#id-uniqueness),
[`block-end-required`](#block-end-required), [`stack-no-coords`](#stack-no-coords)
(REPEAT children inherit STACK's no-coords rule).

#### `EFFECT`

Apply a visual effect (shadow / blur / overlay) to `target-id`.

```
EFFECT <target-id> <effect:EffectType> [param:value ...]
```

Examples:

```
EFFECT login-card shadow blur:24 y:8 color:#0001
EFFECT modal-overlay overlay color:#0008
```

Rules: [`border-inline-only`](#border-inline-only) (use `border:` on RECT/LAYER, not `EFFECT border`).

## 4. Validation rules

Each rule has a stable id used in
[`ValidationWarning.rule`](./src/index.ts). Severity is `error` unless noted.

<a id="screen-first"></a>
### 4.1 `screen-first`

`SCREEN` MUST be the first non-comment line in the document, exactly once.

**Why.** The viewport is required for layout math. Allowing it elsewhere
forces the parser to do two passes.

<a id="stack-no-coords"></a>
### 4.2 `stack-no-coords` *(warning)*

Child commands inside `STACK` and `REPEAT` MUST use `0 0` as their `<x> <y>`
positional values. Auto-layout assigns the real positions; non-zero values
are ignored and emit a warning so authoring mistakes surface.

**Why.** Auto-layout owns positioning; explicit coords are a category error.
Keeping the child grammar uniform (always `<id> <x> <y> ...`) means one
parser path for every command — the alternative (separate "auto-positioned"
signatures per command) doubles the grammar with no upside.

<a id="rect-no-children"></a>
### 4.3 `rect-no-children`

`RECT` is paint-only and MUST NOT open a block. Use `LAYER` for containers.

**Why.** `RECT` exists for cheap fills; container semantics belong to `LAYER`
to keep the parser's "is-this-a-block" decision local.

<a id="id-uniqueness"></a>
### 4.4 `id-uniqueness`

All elements (except `FILL`) MUST have unique ids within a single Scene.
`TOKEN` ids share the same namespace as element ids.

**Why.** `STATE` and `EFFECT` resolve targets by id; collisions would silently
mis-target.

<a id="fill-no-id"></a>
### 4.5 `fill-no-id` *(warning)*

`FILL` MUST NOT carry an id. The grammar reflects this; the rule fires when a
parser encounters `FILL` followed by an extra ident before coords.

**Why.** Naming a paint-only fill suggests it can be referenced — it can't.

<a id="block-end-required"></a>
### 4.6 `block-end-required`

Block commands (`LAYER`, `STACK`, `GRID`, `REPEAT`, `STATE`) MUST be closed
by a literal `END` at the matching depth.

**Why.** Without `END`, nesting is ambiguous and recovery on parse error is
impossible.

<a id="border-inline-only"></a>
### 4.7 `border-inline-only`

Borders on `LAYER` / `RECT` MUST be specified inline via `border:<w> <color>`.
Don't use `EFFECT border` — it is not a valid effect type.

**Why.** Borders affect layout (they take width). Modeling them as effects
would require post-layout passes.

<a id="text-center-needs-maxwidth"></a>
### 4.8 `text-center-needs-maxwidth` *(warning)*

`TEXT` with `align:center` SHOULD set `x:0` and `max-width:` to define the
centering box. Centering without a width has no defined behavior.

**Why.** Center alignment is meaningless without bounds; the warning catches
the most common authoring mistake.

<a id="input-label-clearance"></a>
### 4.9 `input-label-clearance` *(warning)*

`INPUT` with a `label:` SHOULD have `y >= 20` so the rendered label has room
above the input.

**Why.** Labels render above the input by default; tight `y` clips them.

<a id="tap-target-min-height"></a>
### 4.10 `tap-target-min-height` *(warning)*

`BUTTON` and `INPUT` SHOULD have `h >= 36`px (mobile tap target).

**Why.** Sub-36px controls fail accessibility and feel cramped on touch.

<a id="low-contrast"></a>
### 4.11 `low-contrast` *(warning)*

`TEXT` with an explicit `color:` placed inside a `LAYER` with an explicit
`bg:` SHOULD have a WCAG contrast ratio ≥ 3.0 against that background. Token
references are resolved before measuring; non-hex color values are skipped,
as is TEXT with no enclosing explicit background.

**Why.** Neither human reviewers nor vision models measure contrast reliably
— the AST can, deterministically and for free. First rule of the consistency
validator (Level-2 scope, see
`docs/vision-changes/2026-06-12-level-2-interactive-preview-semantic-intent.md`).

## 5. Scene IR mapping

Each command maps to a `Node` `type` discriminator (lowercase command name)
in [`src/index.ts`](./src/index.ts):

| Command  | Node type    |
|----------|--------------|
| SCREEN   | `screen`     |
| TOKEN    | `token`      |
| FILL     | `fill`       |
| RECT     | `rect`       |
| TEXT     | `text`       |
| ICON     | `icon`       |
| IMAGE    | `image`      |
| INPUT    | `input`      |
| BUTTON   | `button`     |
| LAYER    | `layer`      |
| STACK    | `stack`      |
| GRID     | `grid`       |
| STATE    | `state`      |
| REPEAT   | `repeat`     |
| EFFECT   | `effect`     |

`Scene` hoists `screen` and `tokens[]` into dedicated slots so consumers
don't re-validate "SCREEN exists" at the type level. All other commands —
including `STATE` and `EFFECT` — appear in `Scene.nodes` in source order.

## 6. Versioning

- **v0** (current) — unstable. Breaking changes allowed. Names of `type`
  discriminators, param keys, and `ValidationWarning.rule` strings are
  considered part of the public surface; renaming them is a breaking change
  even within v0.
- **v1** — stable. Once promoted, breaking changes require a major bump.

Consumers should pin to a specific `@pixelagent/dsl-spec` version in v0.
