/**
 * Grammar reference exposed as an MCP resource. Hosts (Claude Code etc.)
 * fetch this when they need to compose ops or DSL — keeps the system
 * prompt free of grammar bloat while still letting the model self-serve.
 */
export const GRAMMAR_REFERENCE = `# PixelAgent DSL — quick reference for MCP callers

PixelAgent renders flat UI screens from a line-based declarative DSL.
You generate either (a) a complete DSL for \`pixelagent_preview\` or
(b) patch ops for \`pixelagent_apply_patch\` to surgically edit existing
DSL. Always prefer ops for edits — they cost ~10× fewer tokens than
re-emitting the whole screen.

## Document structure

Every DSL document begins with \`SCREEN <w> <h> [theme:light|dark]\`,
optionally followed by \`TOKEN <id> <value>\` lines, then a body of
nodes. Block commands (LAYER, STACK, GRID, REPEAT, STATE) end with
\`END\`. Comments start with \`#\`. Token references look like \`$id\`.

\`\`\`
SCREEN 1440 900 theme:light
TOKEN primary #185FA5
LAYER login-card 500 260 440 400 bg:$primary r:12
  TEXT brand 0 20 "Acme" size:20 weight:semibold align:center max-width:440
  BUTTON login-btn 32 224 376 48 "Sign in" variant:primary
END
STATE login-btn hover
  bg: #0C447C
END
\`\`\`

## Commands

### Setup
- \`SCREEN <w> <h> [theme:light|dark]\` — viewport. First non-comment line, exactly once.
- \`TOKEN <id> <value>\` — design token. Reference as \`$id\` in any color/value field.

### Paint (no children)
- \`FILL <x> <y> <w> <h> <color>\` — solid color region. No id (paint-only).
- \`RECT <id> <x> <y> <w> <h> [bg:] [r:] [border:<w> <color>]\` — rectangle.
- \`TEXT <id> <x> <y> "<text>" [size:] [weight:regular|medium|semibold|bold] [color:] [align:left|center|right] [max-width:]\`
- \`ICON <id> <x> <y> "<name>" [size:] [color:]\` — \`size\` defaults to 16.
- \`IMAGE <id> <x> <y> <w> <h> "<src>" [fit:cover|contain|fill] [r:]\`

### Components
- \`INPUT <id> <x> <y> <w> <h> [type:text|email|password|number|tel|url] [placeholder:"..."] [label:"..."] [state:default|hover|focus|active|disabled]\`
- \`BUTTON <id> <x> <y> <w> <h> "<label>" [variant:primary|secondary|ghost|destructive] [state:...]\`

### Layout (block — end with END)
- \`LAYER <id> <x> <y> <w> <h> [bg:] [r:] [border:]\` — absolute-positioned children container.
- \`STACK <id> <x> <y> [direction:row|column] [gap:] [align:left|center|right]\` — auto-layout flex. Children must use \`x:0 y:0\`.
- \`GRID <id> <x> <y> <w> columns:N [gap:]\` — grid container, \`columns\` required.
- \`REPEAT <id> <count> [direction:column|row] [gap:]\` — repeats children N times. Renderer auto-suffixes child ids per iteration (\`-1\`, \`-2\`, …).

### Meta
- \`STATE <target-id> <state-name>\` — visual override block. Body is \`key: value\` pairs.
- \`EFFECT <target-id> <type> [params]\` — \`type\` = \`shadow\` | \`blur\` | \`overlay\`. Params: \`x:\`, \`y:\`, \`blur:\`, \`color:\`, \`radius:\`.

## Validation rules to respect

1. SCREEN is exactly once, first non-comment line.
2. All elements (except FILL) need unique \`id\`. Ids may collide across STATE/EFFECT \`targetId\` and node \`id\` — keep them unique.
3. Children of STACK / REPEAT must use \`x:0 y:0\` — they auto-layout.
4. RECT is paint-only. Use LAYER for absolute-positioned containers.
5. Block commands close with \`END\`.
6. Border on LAYER/RECT uses inline \`border:<width> <color>\`. Don't use \`EFFECT border\`.
7. \`TEXT align:center\` requires \`x:0\` plus \`max-width:\`.
8. INPUT with \`label:\` needs \`y >= 20\` for label clearance.
9. INPUT/BUTTON minimum height 36px (tap target).

## Patch ops — for \`pixelagent_apply_patch\`

A patch is an array of ops applied in order. The server validates each
op against the target node type (per-field validation) and skips bad
ones, returning errors in the response.

### \`modify\`
\`\`\`json
{ "op": "modify", "id": "login-btn", "field": "variant", "value": "destructive" }
\`\`\`
- \`field\` is the AST property of the target node. Use \`bg\`, \`color\`,
  \`label\`, \`text\`, \`variant\`, \`size\`, \`weight\`, \`align\`, \`x\`, \`y\`, \`w\`,
  \`h\`, \`r\`, \`placeholder\`, \`state\`, \`gap\`, \`direction\`, \`columns\`,
  \`count\`, \`fit\`, \`src\`, \`name\`. Also \`max-width\` (auto-aliased to
  \`maxWidth\`) and \`type\` on INPUT (auto-aliased to \`inputType\`).
- \`value\`: string for color/enum/text, number for px/integer.
- \`border\`: \`"1 #ccc"\` (width + color, space-separated).
- Enums (variant/state/weight/align/direction/fit/inputType) only accept
  the documented values.

### \`add\`
\`\`\`json
{ "op": "add", "parentId": "login-card", "node": { "type": "text", "id": "extra", "x": 32, "y": 320, "text": "Forgot password?", "size": 12 } }
\`\`\`
- \`parentId\` optional — omit to append at scene root. Parent must be a container (LAYER/STACK/GRID/REPEAT).
- \`node\` shape mirrors the AST type discriminated by \`type\`. Required
  positional fields (id, x, y, w, h depending on type) must be present.

### \`remove\`
\`\`\`json
{ "op": "remove", "id": "pwd-input" }
\`\`\`
Removes the node and any subtree.

## Workflow tip

When the user asks for a small change (\`"make Sign in green"\`,
\`"remove password field"\`, \`"add a forgot link"\`), generate a single
\`pixelagent_apply_patch\` call with one or two ops — never re-emit the
whole DSL. Re-emission is reserved for the initial draft via
\`pixelagent_preview\`.
`;
