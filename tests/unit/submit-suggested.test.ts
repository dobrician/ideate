import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockRequireCsrfToken = vi.fn();
vi.mock("@/lib/csrf", () => ({
  requireCsrfToken: (...args: unknown[]) => mockRequireCsrfToken(...args),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 19, retryAfterMs: 0 }),
}));

const mockInsertValues = vi.fn().mockReturnValue(Promise.resolve());
const mockSelectResults: Array<Promise<unknown[]>> = [];
let selectCallIndex = 0;

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: (...args: unknown[]) => {
        mockInsertValues(...args);
        return Promise.resolve();
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            const idx = selectCallIndex++;
            return mockSelectResults[idx] ?? Promise.resolve([]);
          },
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  projects: { id: "id", deadline: "deadline" },
  proposals: { id: "id", projectId: "project_id" },
  votes: { proposalId: "proposal_id", value: "value" },
}));

const mockEmitVoteUpdate = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/vote-update", () => ({
  emitVoteUpdate: (...args: unknown[]) => mockEmitVoteUpdate(...args),
}));

const mockNotifyVote = vi.fn();
vi.mock("@/lib/notifications", () => ({
  notifyVote: (...args: unknown[]) => mockNotifyVote(...args),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("crypto", () => ({
  randomUUID: () => "mock-uuid",
}));

function setSelectResults(...results: unknown[][]) {
  mockSelectResults.length = 0;
  results.forEach((r) => mockSelectResults.push(Promise.resolve(r)));
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/proposals/submit-suggested", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

import { POST } from "@/app/api/proposals/submit-suggested/route";

describe("POST /api/proposals/submit-suggested", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIndex = 0;
    mockSelectResults.length = 0;
    mockRequireAuth.mockResolvedValue({ id: "u1", role: "member" });
    mockRequireCsrfToken.mockResolvedValue(undefined);
  });

  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const res = await POST(makeRequest({ projectId: "p1", proposals: [], csrfToken: "t" }));
    expect(res.status).toBe(401);
  });

  it("rejects when project deadline has passed", async () => {
    const pastDate = new Date(Date.now() - 86400000);
    setSelectResults([{ id: "p1", deadline: pastDate }]);
    const res = await POST(
      makeRequest({
        projectId: "p1",
        proposals: [{ title: "T", details: "D", summary: "S", vote: 1 }],
        csrfToken: "t",
      })
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("deadline has passed");
  });

  it("creates proposals and emits SSE events on success", async () => {
    const futureDate = new Date(Date.now() + 86400000);
    setSelectResults([{ id: "p1", deadline: futureDate }]);

    const res = await POST(
      makeRequest({
        projectId: "p1",
        proposals: [{ title: "Test Proposal", details: "Details", summary: "Sum", vote: 1 }],
        csrfToken: "t",
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.created).toBe(1);
    expect(mockEmitVoteUpdate).toHaveBeenCalled();
    expect(mockNotifyVote).toHaveBeenCalled();
  });

  it("returns 404 for non-existent project", async () => {
    setSelectResults([]);
    const res = await POST(
      makeRequest({
        projectId: "missing",
        proposals: [{ title: "T", details: "D", summary: "S", vote: 1 }],
        csrfToken: "t",
      })
    );
    expect(res.status).toBe(404);
  });
});
