# xyflow — Verified with LemmaScript

This is a fork of [xyflow/xyflow](https://github.com/xyflow/xyflow) with formal verification of core utility functions using [LemmaScript](https://github.com/midspiral/LemmaScript).
[View as diff](https://github.com/midspiral/xyflow-lemmascript/compare/main..lemmascript).

LemmaScript annotates TypeScript directly with `//@ ` specifications and generates Dafny for verification. The original code is unchanged — only annotation comments are added.

## What's Verified

### Edge Utilities (`packages/system/src/utils/edges/general.ts`)

**`getEdgeCenter`** — Computes the midpoint and offsets between source and target handles.
- Center X is between sourceX and targetX
- Center Y is between sourceY and targetY
- Offsets are non-negative

**`connectionExists`** — Checks if an edge with matching source/target/handles already exists.
- Empty edges array → returns false
- True result implies non-empty array

**`addEdge`** — Adds an edge to an array, deduplicating by connection.
- Result length >= input length (never loses edges)
- Result length <= input length + 1 (adds at most one)

**`reconnectEdge`** — Replaces an existing edge with a new connection.
- Result length >= 1 (or input was empty)
- Result length <= input length + 1

### Geometry Utilities (`packages/system/src/utils/general.ts`)

**`clamp`** — Clamps a value to [min, max].
- Result is within [min, max] (given min <= max)

**`rectToBox`** / **`boxToRect`** — Convert between Rect and Box representations.
- Field values match input arithmetic exactly

**`getBoundsOfBoxes`** — Computes bounding box of two boxes.
- Result encloses both input boxes

**`getOverlappingArea`** — Computes overlap area of two rectangles.
- Result is non-negative

**`areSetsEqual`** — Checks if two string sets are equal by size + membership.
- True result implies same size
- True result implies a is subset of b (forall x in a ==> x in b)

## Setup

**Prerequisites:** [Dafny](https://github.com/dafny-lang/dafny) ≥ 4.0, Node.js ≥ 18.

```sh
git clone https://github.com/midspiral/LemmaScript.git ../LemmaScript
cd ../LemmaScript && npm install && npm run build
```

## Verify

```sh
../LemmaScript/tools/check.sh dafny
```

## How It Works

Annotations are TypeScript comments — invisible to `tsc`, visible to LemmaScript:

```typescript
//@ verify
//@ requires min <= max
//@ ensures min <= \result && \result <= max
export const clamp = (val: number, min = 0, max = 1): number =>
  Math.min(Math.max(val, min), max);
```

For types that ts-morph can't resolve (monorepo bundler resolution), `declare-type` provides the definition:

```typescript
//@ declare-type Box { x: number, y: number, x2: number, y2: number }
```

For side-effect statements not relevant to verification, `skip` omits them:

```typescript
//@ skip
devWarn('006', errorMessages['error006']());
```

For code with nondeterministic behavior (external calls, dynamic dispatch), `havoc` replaces the value:

```typescript
//@ havoc
const edgeIdGenerator = options.getEdgeId || getEdgeId;
```

Generics erase to their constraint bound: `<EdgeType extends EdgeBase>` → `EdgeBase`. Union parameters resolve to the field intersection: `EdgeBase | Connection` → `Connection` (common fields only).
