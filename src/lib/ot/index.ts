/**
 * Operational Transform (OT) engine for collaborative text editing.
 *
 * Supports three operation types:
 * - retain(n): Keep n characters unchanged
 * - insert(s): Insert string s at current position
 * - delete(n): Delete n characters at current position
 *
 * Key operations:
 * - apply(): Apply an operation to a document string
 * - compose(): Combine two sequential operations into one
 * - transform(): Transform two concurrent operations for convergence
 */

// ─── Types ──────────────────────────────────────────────────────────────

export type Op =
  | { type: "retain"; count: number }
  | { type: "insert"; text: string }
  | { type: "delete"; count: number };

export interface TextOperation {
  ops: Op[];
  /** Length of the document this operation applies to */
  baseLength: number;
  /** Length of the document after applying this operation */
  targetLength: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function opLength(op: Op): number {
  switch (op.type) {
    case "retain": return op.count;
    case "insert": return op.text.length;
    case "delete": return op.count;
  }
}

/** Create a compact operation, merging adjacent ops of the same type */
function compactOps(ops: Op[]): Op[] {
  const result: Op[] = [];
  for (const op of ops) {
    if (op.type === "retain" && op.count === 0) continue;
    if (op.type === "insert" && op.text === "") continue;
    if (op.type === "delete" && op.count === 0) continue;

    const last = result[result.length - 1];
    if (last?.type === "retain" && op.type === "retain") {
      result[result.length - 1] = { type: "retain", count: last.count + op.count };
    } else if (last?.type === "insert" && op.type === "insert") {
      result[result.length - 1] = { type: "insert", text: last.text + op.text };
    } else if (last?.type === "delete" && op.type === "delete") {
      result[result.length - 1] = { type: "delete", count: last.count + op.count };
    } else {
      result.push(op);
    }
  }
  return result;
}

// ─── Build Operations ───────────────────────────────────────────────────

export function buildOperation(baseLength: number, ops: Op[]): TextOperation {
  const compact = compactOps(ops);
  let bl = 0;
  let tl = 0;
  for (const op of compact) {
    switch (op.type) {
      case "retain": bl += op.count; tl += op.count; break;
      case "insert": tl += op.text.length; break;
      case "delete": bl += op.count; break;
    }
  }
  if (bl !== baseLength) {
    throw new Error(`Operation base length mismatch: expected ${baseLength}, got ${bl}`);
  }
  return { ops: compact, baseLength: bl, targetLength: tl };
}

// ─── Apply ──────────────────────────────────────────────────────────────

/** Apply an operation to a document string */
export function apply(doc: string, operation: TextOperation): string {
  if (doc.length !== operation.baseLength) {
    throw new Error(`Document length (${doc.length}) doesn't match operation base length (${operation.baseLength})`);
  }

  const parts: string[] = [];
  let pos = 0;

  for (const op of operation.ops) {
    switch (op.type) {
      case "retain":
        parts.push(doc.slice(pos, pos + op.count));
        pos += op.count;
        break;
      case "insert":
        parts.push(op.text);
        break;
      case "delete":
        pos += op.count;
        break;
    }
  }

  return parts.join("");
}

// ─── Compose ────────────────────────────────────────────────────────────

/** Compose two sequential operations into a single operation */
export function compose(a: TextOperation, b: TextOperation): TextOperation {
  if (a.targetLength !== b.baseLength) {
    throw new Error("Cannot compose: a.targetLength !== b.baseLength");
  }

  const ops: Op[] = [];
  let ia = 0;
  let ib = 0;
  let oa = a.ops[ia];
  let ob = b.ops[ib];

  while (oa || ob) {
    // Delete from A consumes from original doc — always emitted first
    if (oa?.type === "delete") {
      ops.push(oa);
      ia++;
      oa = a.ops[ia];
      continue;
    }
    // Insert from B adds to final output — always emitted second
    if (ob?.type === "insert") {
      ops.push(ob);
      ib++;
      ob = b.ops[ib];
      continue;
    }

    if (!oa || !ob) throw new Error("Compose ran out of operations prematurely");

    // After the early returns, oa is retain|insert and ob is retain|delete.
    // Cast to widen TS narrowing back to full Op union.
    const curA = oa as Op;
    const curB = ob as Op;

    if (curA.type === "retain" && curB.type === "retain") {
      const min = Math.min(curA.count, curB.count);
      ops.push({ type: "retain", count: min });
      if (curA.count > min) oa = { type: "retain", count: curA.count - min };
      else { ia++; oa = a.ops[ia]; }
      if (curB.count > min) ob = { type: "retain", count: curB.count - min };
      else { ib++; ob = b.ops[ib]; }
    } else if (curA.type === "insert" && curB.type === "retain") {
      const min = Math.min(curA.text.length, curB.count);
      ops.push({ type: "insert", text: curA.text.slice(0, min) });
      if (curA.text.length > min) oa = { type: "insert", text: curA.text.slice(min) };
      else { ia++; oa = a.ops[ia]; }
      if (curB.count > min) ob = { type: "retain", count: curB.count - min };
      else { ib++; ob = b.ops[ib]; }
    } else if (curA.type === "insert" && curB.type === "delete") {
      // Insert from A consumed by delete from B — they cancel
      const min = Math.min(curA.text.length, curB.count);
      if (curA.text.length > min) oa = { type: "insert", text: curA.text.slice(min) };
      else { ia++; oa = a.ops[ia]; }
      if (curB.count > min) ob = { type: "delete", count: curB.count - min };
      else { ib++; ob = b.ops[ib]; }
    } else if (curA.type === "retain" && curB.type === "delete") {
      const min = Math.min(curA.count, curB.count);
      ops.push({ type: "delete", count: min });
      if (curA.count > min) oa = { type: "retain", count: curA.count - min };
      else { ia++; oa = a.ops[ia]; }
      if (curB.count > min) ob = { type: "delete", count: curB.count - min };
      else { ib++; ob = b.ops[ib]; }
    } else {
      throw new Error(`Unexpected compose combination: ${curA.type} + ${curB.type}`);
    }
  }

  return buildOperation(a.baseLength, compactOps(ops));
}

// ─── Transform ──────────────────────────────────────────────────────────

/**
 * Transform two concurrent operations so they can both be applied.
 * Given operations A and B on the same document, produces A' and B' such that:
 *   apply(apply(doc, A), B') === apply(apply(doc, B), A')
 *
 * @param a First operation
 * @param b Second operation
 * @returns [aPrime, bPrime] transformed operations
 */
export function transform(
  a: TextOperation,
  b: TextOperation,
): [TextOperation, TextOperation] {
  if (a.baseLength !== b.baseLength) {
    throw new Error("Transform requires same base length");
  }

  const aOps: Op[] = [];
  const bOps: Op[] = [];
  let ia = 0;
  let ib = 0;
  let oa = a.ops[ia];
  let ob = b.ops[ib];

  while (oa || ob) {
    // Insert in A: A' retains the insert, B' inserts
    if (oa?.type === "insert") {
      aOps.push(oa);
      bOps.push({ type: "retain", count: oa.text.length });
      ia++;
      oa = a.ops[ia];
      continue;
    }
    // Insert in B: B' retains the insert, A' inserts
    if (ob?.type === "insert") {
      bOps.push(ob);
      aOps.push({ type: "retain", count: ob.text.length });
      ib++;
      ob = b.ops[ib];
      continue;
    }

    if (!oa || !ob) throw new Error("Transform ran out of operations");

    if (oa.type === "retain" && ob.type === "retain") {
      const min = Math.min(oa.count, ob.count);
      aOps.push({ type: "retain", count: min });
      bOps.push({ type: "retain", count: min });
      if (oa.count > min) oa = { type: "retain", count: oa.count - min };
      else { ia++; oa = a.ops[ia]; }
      if (ob.count > min) ob = { type: "retain", count: ob.count - min };
      else { ib++; ob = b.ops[ib]; }
    } else if (oa.type === "delete" && ob.type === "delete") {
      const min = Math.min(oa.count, ob.count);
      // Both deleted same region — nothing to emit
      if (oa.count > min) oa = { type: "delete", count: oa.count - min };
      else { ia++; oa = a.ops[ia]; }
      if (ob.count > min) ob = { type: "delete", count: ob.count - min };
      else { ib++; ob = b.ops[ib]; }
    } else if (oa.type === "delete" && ob.type === "retain") {
      const min = Math.min(oa.count, ob.count);
      aOps.push({ type: "delete", count: min });
      // B' doesn't need to retain what A deleted
      if (oa.count > min) oa = { type: "delete", count: oa.count - min };
      else { ia++; oa = a.ops[ia]; }
      if (ob.count > min) ob = { type: "retain", count: ob.count - min };
      else { ib++; ob = b.ops[ib]; }
    } else if (oa.type === "retain" && ob.type === "delete") {
      const min = Math.min(oa.count, ob.count);
      bOps.push({ type: "delete", count: min });
      if (oa.count > min) oa = { type: "retain", count: oa.count - min };
      else { ia++; oa = a.ops[ia]; }
      if (ob.count > min) ob = { type: "delete", count: ob.count - min };
      else { ib++; ob = b.ops[ib]; }
    } else {
      throw new Error(`Unexpected transform pair: ${oa.type} + ${ob.type}`);
    }
  }

  return [
    buildOperation(b.targetLength, compactOps(aOps)),
    buildOperation(a.targetLength, compactOps(bOps)),
  ];
}

// ─── Cursor Transform ───────────────────────────────────────────────────

/** Transform a cursor position through an operation */
export function transformCursor(cursor: number, operation: TextOperation): number {
  let pos = 0;
  let newPos = cursor;

  for (const op of operation.ops) {
    if (pos >= cursor) break;

    switch (op.type) {
      case "retain":
        pos += op.count;
        break;
      case "insert":
        newPos += op.text.length;
        break;
      case "delete": {
        const deleted = Math.min(op.count, Math.max(0, cursor - pos));
        newPos -= deleted;
        pos += op.count;
        break;
      }
    }
  }

  return Math.max(0, newPos);
}

// ─── Diff → Operation ───────────────────────────────────────────────────

/** Create an operation from old and new text (simple diff) */
export function createFromDiff(oldText: string, newText: string): TextOperation {
  // Find common prefix
  let prefixLen = 0;
  while (prefixLen < oldText.length && prefixLen < newText.length && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++;
  }

  // Find common suffix (not overlapping prefix)
  let suffixLen = 0;
  while (
    suffixLen < oldText.length - prefixLen &&
    suffixLen < newText.length - prefixLen &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const ops: Op[] = [];
  if (prefixLen > 0) ops.push({ type: "retain", count: prefixLen });

  const deletedLen = oldText.length - prefixLen - suffixLen;
  if (deletedLen > 0) ops.push({ type: "delete", count: deletedLen });

  const insertedText = newText.slice(prefixLen, newText.length - suffixLen);
  if (insertedText.length > 0) ops.push({ type: "insert", text: insertedText });

  if (suffixLen > 0) ops.push({ type: "retain", count: suffixLen });

  return buildOperation(oldText.length, ops);
}
