import { describe, it, expect } from "vitest";
import { withTimeout, TimeoutError } from "@/lib/with-timeout";

describe("withTimeout", () => {
  it("resolves when operation completes within timeout", async () => {
    const result = await withTimeout(
      async () => "done",
      1000,
    );
    expect(result).toBe("done");
  });

  it("passes abort signal to the function", async () => {
    let receivedSignal: AbortSignal | null = null;
    await withTimeout(
      async (signal) => {
        receivedSignal = signal;
        return "ok";
      },
      1000,
    );
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal!.aborted).toBe(false);
  });

  it("throws TimeoutError when operation exceeds timeout", async () => {
    await expect(
      withTimeout(
        () => new Promise((resolve) => setTimeout(resolve, 500)),
        50,
      ),
    ).rejects.toThrow(TimeoutError);
  });

  it("TimeoutError includes timeout duration in message", async () => {
    try {
      await withTimeout(
        () => new Promise((resolve) => setTimeout(resolve, 500)),
        75,
      );
    } catch (err) {
      expect(err).toBeInstanceOf(TimeoutError);
      expect((err as TimeoutError).message).toContain("75ms");
    }
  });

  it("propagates non-timeout errors", async () => {
    await expect(
      withTimeout(
        async () => { throw new Error("boom"); },
        1000,
      ),
    ).rejects.toThrow("boom");
  });

  it("clears timer on successful completion", async () => {
    const result = await withTimeout(async () => 42, 5000);
    expect(result).toBe(42);
    // If timer wasn't cleared, this test would hang for 5s
  });
});
