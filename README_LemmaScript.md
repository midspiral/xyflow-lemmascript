# xyflow — Verified with LemmaScript

This is a fork of [xyflow/xyflow](https://github.com/xyflow/xyflow) with formal verification of core utility functions using [LemmaScript](https://github.com/midspiral/LemmaScript).
[View as diff](https://github.com/midspiral/xyflow-lemmascript/compare/main..lemmascript).

LemmaScript annotates TypeScript directly with `//@ ` specifications and generates Dafny for verification. For the utility functions below, the original code is unchanged — only annotation comments are added. The cycle-prevention gate is different: it adds new verified functions rather than annotating existing ones.

## What's Verified

### Cycle Prevention (`packages/system/src/utils/graph.ts`)

Gates connections so the graph stays acyclic. Node-level (source/target ids), next to `getOutgoers`/`getIncomers`.

**`canReach`** — bounded reachability search; terminates, and decides the path-witness predicate `reach` exactly.
- Sound: `\result ==> reach(edges, from, to)`
- Complete: `reach(edges, from, to) ==> \result`

**`wouldCreateCycle`** — `canReach(edges, target, source)`: adding `source -> target` makes a cycle iff `target` already reaches `source` (reflexivity rejects self-loops too).

**Acyclicity bridge** — `acyclic(edges) ==> ( acyclic(edges + e) <==> !wouldCreateCycle(edges, src, tgt) )`: gated insertion never creates a cycle, and never blocks a safe edge.

**Reconnect** — `ReconnectBridge`: a subgraph of an acyclic graph is acyclic (removing an edge can't create a cycle), so reconnecting an edge (remove the old one, gated-add the new endpoints) preserves acyclicity too. The gate covers `onReconnect`, not just `onConnect` — closing every edge-mutation path.

**Base case** — `isAcyclic(edges)` decides whether the whole graph is acyclic (sound *and* complete: `isAcyclic ⟺ acyclic`), the dual of the gate. Run it on an initial or imported graph to *establish* the invariant the gate then *maintains* — together they make "the graph is always acyclic" airtight. The demo runs it live as a continuous invariant check.

**Topological-rank witness** — `rank(n)` = number of nodes that can reach `n`; proven (`TopoRankMonotone`) to strictly increase along every edge of an acyclic graph, so sorting nodes by `rank` is a safe evaluation order. `canReach` is exported as a public primitive; the count + sort are trusted glue over it.

Predicate `reach` and the path lemmas are hand-written in `graph.dfy` (additions-only). Trust manifest: proof is over `EdgeBase[]`/node ids (no React), and holds only if every commit routes through the gate. Demonstrated in the `CycleGate` example (`examples/react/src/examples/CycleGate/`) via `onConnect` (commit) + `isValidConnection` (drag feedback): drag a loop and it is rejected on screen (red dashed line), while a live "safe evaluation order" reflects the topological rank.

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

**`reconnectEdge`** — Replaces an existing edge with a new connection. Under a unique-id precondition:
- Result length >= 1 (or input was empty)
- Result length <= input length (in-place; no insertion)
- When a matching edge existed and `newConnection.source`/`target` are non-empty, the result contains an edge with those endpoints

Trust manifest: destructuring (`oldEdgeId === oldEdge.id`), `find` semantics on both branches, and constructed edge fields (`edge.source === newConnection.source`, `edge.target === newConnection.target`).

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
