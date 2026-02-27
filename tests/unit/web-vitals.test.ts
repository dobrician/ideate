import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  rateMetric,
  recordVital,
  flushVitals,
  getVitalsBuffer,
  clearVitalsBuffer,
} from "@/lib/web-vitals";

// Mock navigator.sendBeacon for Node environment
const mockSendBeacon = vi.fn(() => true);
vi.stubGlobal("navigator", { sendBeacon: mockSendBeacon });
vi.stubGlobal("location", { pathname: "/test" });

describe("web-vitals", () => {
  beforeEach(() => {
    clearVitalsBuffer();
    mockSendBeacon.mockClear();
  });

  describe("rateMetric", () => {
    it("rates LCP as good when <= 2500", () => {
      expect(rateMetric("LCP", 2000)).toBe("good");
      expect(rateMetric("LCP", 2500)).toBe("good");
    });

    it("rates LCP as needs-improvement when > 2500 and <= 4000", () => {
      expect(rateMetric("LCP", 3000)).toBe("needs-improvement");
      expect(rateMetric("LCP", 4000)).toBe("needs-improvement");
    });

    it("rates LCP as poor when > 4000", () => {
      expect(rateMetric("LCP", 5000)).toBe("poor");
    });

    it("rates FID correctly", () => {
      expect(rateMetric("FID", 50)).toBe("good");
      expect(rateMetric("FID", 200)).toBe("needs-improvement");
      expect(rateMetric("FID", 400)).toBe("poor");
    });

    it("rates CLS correctly", () => {
      expect(rateMetric("CLS", 0.05)).toBe("good");
      expect(rateMetric("CLS", 0.15)).toBe("needs-improvement");
      expect(rateMetric("CLS", 0.3)).toBe("poor");
    });

    it("rates INP correctly", () => {
      expect(rateMetric("INP", 150)).toBe("good");
      expect(rateMetric("INP", 300)).toBe("needs-improvement");
      expect(rateMetric("INP", 600)).toBe("poor");
    });

    it("rates TTFB correctly", () => {
      expect(rateMetric("TTFB", 500)).toBe("good");
      expect(rateMetric("TTFB", 1000)).toBe("needs-improvement");
      expect(rateMetric("TTFB", 2000)).toBe("poor");
    });

    it("returns good for unknown metric names", () => {
      expect(rateMetric("UNKNOWN", 9999)).toBe("good");
    });
  });

  describe("recordVital", () => {
    it("adds metric to buffer", () => {
      recordVital("LCP", 2000);
      const buffer = getVitalsBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].name).toBe("LCP");
      expect(buffer[0].value).toBe(2000);
      expect(buffer[0].rating).toBe("good");
    });

    it("records navigation type", () => {
      recordVital("LCP", 2000, "reload");
      const buffer = getVitalsBuffer();
      expect(buffer[0].navigationType).toBe("reload");
    });

    it("defaults navigation type to navigate", () => {
      recordVital("LCP", 2000);
      expect(getVitalsBuffer()[0].navigationType).toBe("navigate");
    });

    it("rounds CLS values correctly", () => {
      recordVital("CLS", 0.123456);
      expect(getVitalsBuffer()[0].value).toBe(0.123);
    });

    it("rounds non-CLS values to integers", () => {
      recordVital("LCP", 2345.678);
      expect(getVitalsBuffer()[0].value).toBe(2346);
    });

    it("buffers multiple metrics", () => {
      recordVital("LCP", 2000);
      recordVital("FID", 50);
      recordVital("CLS", 0.05);
      expect(getVitalsBuffer()).toHaveLength(3);
    });
  });

  describe("flushVitals", () => {
    it("does nothing when buffer is empty", () => {
      flushVitals();
      expect(mockSendBeacon).not.toHaveBeenCalled();
    });

    it("sends beacon with metrics when buffer has data", () => {
      recordVital("LCP", 2000);
      flushVitals();
      expect(mockSendBeacon).toHaveBeenCalledOnce();
      const [url, body] = mockSendBeacon.mock.calls[0];
      expect(url).toBe("/api/perf/vitals");
      const parsed = JSON.parse(body as string);
      expect(parsed.metrics).toHaveLength(1);
      expect(parsed.metrics[0].name).toBe("LCP");
    });

    it("clears buffer after flush", () => {
      recordVital("LCP", 2000);
      flushVitals();
      expect(getVitalsBuffer()).toHaveLength(0);
    });
  });

  describe("clearVitalsBuffer", () => {
    it("clears all buffered metrics", () => {
      recordVital("LCP", 2000);
      recordVital("FID", 50);
      clearVitalsBuffer();
      expect(getVitalsBuffer()).toHaveLength(0);
    });
  });
});
