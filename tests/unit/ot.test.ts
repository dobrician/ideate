import { describe, it, expect } from "vitest";
import {
  buildOperation,
  apply,
  compose,
  transform,
  transformCursor,
  createFromDiff,
  type TextOperation,
  type Op,
} from "@/lib/ot";

// ─── Helpers ────────────────────────────────────────────────────────────

function makeOp(baseLength: number, ops: Op[]): TextOperation {
  return buildOperation(baseLength, ops);
}

function ins(text: string): Op {
  return { type: "insert", text };
}
function del(count: number): Op {
  return { type: "delete", count };
}
function ret(count: number): Op {
  return { type: "retain", count };
}

// ─── buildOperation ─────────────────────────────────────────────────────

describe("buildOperation", () => {
  it("creates a valid operation from ops", () => {
    const op = buildOperation(5, [ret(3), del(2)]);
    expect(op.baseLength).toBe(5);
    expect(op.targetLength).toBe(3);
    expect(op.ops).toHaveLength(2);
  });

  it("compacts adjacent same-type ops", () => {
    const op = buildOperation(6, [ret(2), ret(4)]);
    expect(op.ops).toHaveLength(1);
    expect(op.ops[0]).toEqual(ret(6));
  });

  it("removes zero-length ops", () => {
    const op = buildOperation(3, [ret(0), ret(3), del(0)]);
    expect(op.ops).toHaveLength(1);
  });

  it("throws on base length mismatch", () => {
    expect(() => buildOperation(10, [ret(3)])).toThrow("base length mismatch");
  });

  it("computes targetLength correctly for insert+delete", () => {
    const op = buildOperation(5, [ret(2), del(3), ins("hello")]);
    expect(op.baseLength).toBe(5);
    expect(op.targetLength).toBe(7); // 2 retained + 5 inserted
  });
});

// ─── apply ──────────────────────────────────────────────────────────────

describe("apply", () => {
  it("retains the entire document unchanged", () => {
    const doc = "hello";
    const op = makeOp(5, [ret(5)]);
    expect(apply(doc, op)).toBe("hello");
  });

  it("inserts text at the beginning", () => {
    const doc = "world";
    const op = makeOp(5, [ins("hello "), ret(5)]);
    expect(apply(doc, op)).toBe("hello world");
  });

  it("inserts text at the end", () => {
    const doc = "hello";
    const op = makeOp(5, [ret(5), ins(" world")]);
    expect(apply(doc, op)).toBe("hello world");
  });

  it("deletes text from the beginning", () => {
    const doc = "hello world";
    const op = makeOp(11, [del(6), ret(5)]);
    expect(apply(doc, op)).toBe("world");
  });

  it("replaces text in the middle", () => {
    const doc = "hello world";
    const op = makeOp(11, [ret(6), del(5), ins("there")]);
    expect(apply(doc, op)).toBe("hello there");
  });

  it("handles empty document with insert", () => {
    const op = makeOp(0, [ins("new")]);
    expect(apply("", op)).toBe("new");
  });

  it("handles delete entire document", () => {
    const doc = "abc";
    const op = makeOp(3, [del(3)]);
    expect(apply(doc, op)).toBe("");
  });

  it("throws on length mismatch", () => {
    const op = makeOp(5, [ret(5)]);
    expect(() => apply("hi", op)).toThrow("doesn't match");
  });

  it("handles complex multi-op sequence", () => {
    const doc = "abcdefgh";
    const op = makeOp(8, [ret(2), del(2), ins("XY"), ret(2), del(2), ins("Z")]);
    expect(apply(doc, op)).toBe("abXYefZ");
  });
});

// ─── compose ────────────────────────────────────────────────────────────

describe("compose", () => {
  it("composes two sequential retain-only operations", () => {
    const a = makeOp(5, [ret(5)]);
    const b = makeOp(5, [ret(5)]);
    const c = compose(a, b);
    expect(apply("hello", c)).toBe("hello");
  });

  it("composes insert then delete", () => {
    const doc = "abc";
    const a = makeOp(3, [ret(1), ins("X"), ret(2)]);
    const b = makeOp(4, [ret(1), del(1), ret(2)]); // remove the X
    const c = compose(a, b);
    expect(apply(doc, c)).toBe("abc");
  });

  it("composes two inserts", () => {
    const doc = "";
    const a = makeOp(0, [ins("hello")]);
    const b = makeOp(5, [ret(5), ins(" world")]);
    const c = compose(a, b);
    expect(apply(doc, c)).toBe("hello world");
  });

  it("composes delete then insert", () => {
    const doc = "hello";
    const a = makeOp(5, [del(5)]);
    const b = makeOp(0, [ins("world")]);
    const c = compose(a, b);
    expect(apply(doc, c)).toBe("world");
  });

  it("throws on target/base mismatch", () => {
    const a = makeOp(5, [ret(5)]);
    const b = makeOp(3, [ret(3)]);
    expect(() => compose(a, b)).toThrow("a.targetLength !== b.baseLength");
  });

  it("composes overlapping deletes", () => {
    const doc = "abcdef";
    const a = makeOp(6, [ret(2), del(2), ret(2)]); // "abef"
    const b = makeOp(4, [ret(1), del(2), ret(1)]); // remove "be" → "af"
    const c = compose(a, b);
    expect(apply(doc, c)).toBe("af");
  });

  it("is equivalent to applying both operations sequentially", () => {
    const doc = "the quick brown fox";
    const a = makeOp(19, [ret(4), del(6), ins("slow "), ret(9)]);
    const b = makeOp(18, [ret(9), del(9), ins("cat")]);
    const composed = compose(a, b);
    const sequential = apply(apply(doc, a), b);
    expect(apply(doc, composed)).toBe(sequential);
  });
});

// ─── transform ──────────────────────────────────────────────────────────

describe("transform", () => {
  it("transforms two retains (identity)", () => {
    const doc = "hello";
    const a = makeOp(5, [ret(5)]);
    const b = makeOp(5, [ret(5)]);
    const [aPrime, bPrime] = transform(a, b);
    expect(apply(apply(doc, a), bPrime)).toBe(apply(apply(doc, b), aPrime));
  });

  it("transforms concurrent inserts at same position", () => {
    const doc = "abc";
    const a = makeOp(3, [ins("X"), ret(3)]);
    const b = makeOp(3, [ins("Y"), ret(3)]);
    const [aPrime, bPrime] = transform(a, b);
    // Both paths should converge
    const fromA = apply(apply(doc, a), bPrime);
    const fromB = apply(apply(doc, b), aPrime);
    expect(fromA).toBe(fromB);
  });

  it("transforms concurrent inserts at different positions", () => {
    const doc = "abcdef";
    const a = makeOp(6, [ret(2), ins("X"), ret(4)]);
    const b = makeOp(6, [ret(5), ins("Y"), ret(1)]);
    const [aPrime, bPrime] = transform(a, b);
    const fromA = apply(apply(doc, a), bPrime);
    const fromB = apply(apply(doc, b), aPrime);
    expect(fromA).toBe(fromB);
    expect(fromA).toBe("abXcdeYf");
  });

  it("transforms insert vs delete (no overlap)", () => {
    const doc = "abcdef";
    const a = makeOp(6, [ret(2), ins("X"), ret(4)]);
    const b = makeOp(6, [ret(4), del(2)]);
    const [aPrime, bPrime] = transform(a, b);
    const fromA = apply(apply(doc, a), bPrime);
    const fromB = apply(apply(doc, b), aPrime);
    expect(fromA).toBe(fromB);
  });

  it("transforms concurrent deletes at same position", () => {
    const doc = "abcdef";
    const a = makeOp(6, [del(3), ret(3)]);
    const b = makeOp(6, [del(3), ret(3)]);
    const [aPrime, bPrime] = transform(a, b);
    const fromA = apply(apply(doc, a), bPrime);
    const fromB = apply(apply(doc, b), aPrime);
    expect(fromA).toBe(fromB);
    expect(fromA).toBe("def");
  });

  it("transforms overlapping deletes", () => {
    const doc = "abcdef";
    const a = makeOp(6, [ret(1), del(3), ret(2)]); // "aef"
    const b = makeOp(6, [ret(2), del(3), ret(1)]); // "abf"
    const [aPrime, bPrime] = transform(a, b);
    const fromA = apply(apply(doc, a), bPrime);
    const fromB = apply(apply(doc, b), aPrime);
    expect(fromA).toBe(fromB);
    expect(fromA).toBe("af");
  });

  it("throws on base length mismatch", () => {
    const a = makeOp(5, [ret(5)]);
    const b = makeOp(3, [ret(3)]);
    expect(() => transform(a, b)).toThrow("same base length");
  });

  it("convergence property holds for complex operations", () => {
    const doc = "hello world";
    const a = makeOp(11, [ret(5), del(1), ins("-"), ret(5)]); // "hello-world"
    const b = makeOp(11, [ret(6), del(5), ins("there")]); // "hello there"
    const [aPrime, bPrime] = transform(a, b);
    const fromA = apply(apply(doc, a), bPrime);
    const fromB = apply(apply(doc, b), aPrime);
    expect(fromA).toBe(fromB);
  });
});

// ─── transformCursor ────────────────────────────────────────────────────

describe("transformCursor", () => {
  it("retains cursor position through retain-only op", () => {
    const op = makeOp(10, [ret(10)]);
    expect(transformCursor(5, op)).toBe(5);
  });

  it("shifts cursor right on insert before cursor", () => {
    const op = makeOp(10, [ret(3), ins("XX"), ret(7)]);
    expect(transformCursor(5, op)).toBe(7); // shifted by 2
  });

  it("keeps cursor position on insert after cursor", () => {
    const op = makeOp(10, [ret(7), ins("XX"), ret(3)]);
    expect(transformCursor(5, op)).toBe(5); // insert is after cursor
  });

  it("shifts cursor left on delete before cursor", () => {
    const op = makeOp(10, [ret(2), del(2), ret(6)]);
    expect(transformCursor(5, op)).toBe(3); // shifted left by 2
  });

  it("clamps cursor to 0", () => {
    const op = makeOp(5, [del(5)]);
    expect(transformCursor(3, op)).toBe(0);
  });

  it("handles cursor at position 0", () => {
    const op = makeOp(5, [ins("X"), ret(5)]);
    expect(transformCursor(0, op)).toBe(0);
  });

  it("handles cursor at end of document", () => {
    const op = makeOp(5, [ret(5), ins("X")]);
    expect(transformCursor(5, op)).toBe(5);
  });
});

// ─── createFromDiff ─────────────────────────────────────────────────────

describe("createFromDiff", () => {
  it("creates identity for identical strings", () => {
    const op = createFromDiff("hello", "hello");
    expect(op.ops).toEqual([ret(5)]);
    expect(apply("hello", op)).toBe("hello");
  });

  it("detects insertion at end", () => {
    const op = createFromDiff("hello", "hello world");
    expect(apply("hello", op)).toBe("hello world");
  });

  it("detects insertion at beginning", () => {
    const op = createFromDiff("world", "hello world");
    expect(apply("world", op)).toBe("hello world");
  });

  it("detects deletion at end", () => {
    const op = createFromDiff("hello world", "hello");
    expect(apply("hello world", op)).toBe("hello");
  });

  it("detects deletion at beginning", () => {
    const op = createFromDiff("hello world", "world");
    expect(apply("hello world", op)).toBe("world");
  });

  it("detects replacement in middle", () => {
    const op = createFromDiff("hello world", "hello there");
    expect(apply("hello world", op)).toBe("hello there");
  });

  it("handles empty to non-empty", () => {
    const op = createFromDiff("", "hello");
    expect(apply("", op)).toBe("hello");
  });

  it("handles non-empty to empty", () => {
    const op = createFromDiff("hello", "");
    expect(apply("hello", op)).toBe("");
  });

  it("handles complete replacement", () => {
    const op = createFromDiff("abc", "xyz");
    expect(apply("abc", op)).toBe("xyz");
  });

  it("handles single character insert", () => {
    const op = createFromDiff("hllo", "hello");
    expect(apply("hllo", op)).toBe("hello");
  });
});
