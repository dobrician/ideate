/**
 * Unit tests for workflow engine module.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSelectChain = vi.fn();
const mockInsertChain = vi.fn();
const mockUpdateChain = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (fields?: unknown) => ({
      from: (table?: unknown) => ({
        where: (...args: unknown[]) => {
          const baseResult = mockSelectChain("select-where", fields, table, ...args);
          const arr = baseResult ?? [];
          const bp = Promise.resolve(arr);
          return {
            then: bp.then.bind(bp),
            catch: bp.catch.bind(bp),
            limit: (_n: number) => {
              const limitResult = mockSelectChain("select-where-limit", fields, table, ...args);
              const lp = Promise.resolve(limitResult ?? arr);
              return { then: lp.then.bind(lp), catch: lp.catch.bind(lp) };
            },
            orderBy: (..._oArgs: unknown[]) => {
              const orderResult = mockSelectChain("select-where-orderBy", fields, table, ...args);
              const op = Promise.resolve(orderResult ?? arr);
              return { then: op.then.bind(op), catch: op.catch.bind(op) };
            },
            onConflictDoUpdate: (_cfg: unknown) => {
              const cp = Promise.resolve(arr);
              return { then: cp.then.bind(cp), catch: cp.catch.bind(cp) };
            },
          };
        },
        orderBy: (...args: unknown[]) => {
          const result = mockSelectChain("select-orderBy", fields, table, ...args);
          const p = Promise.resolve(result ?? []);
          return { then: p.then.bind(p), catch: p.catch.bind(p) };
        },
      }),
    }),
    insert: (table?: unknown) => ({
      values: (data?: unknown) => {
        const result = mockInsertChain("insert-values", table, data);
        const p = Promise.resolve(result);
        return {
          then: p.then.bind(p),
          catch: p.catch.bind(p),
          onConflictDoUpdate: (_cfg: unknown) => {
            const cp = Promise.resolve(result);
            return { then: cp.then.bind(cp), catch: cp.catch.bind(cp) };
          },
        };
      },
    }),
    update: (table?: unknown) => ({
      set: (data?: unknown) => ({
        where: (...args: unknown[]) => {
          const result = mockUpdateChain("update-set-where", table, data, ...args);
          const p = Promise.resolve(result);
          return { then: p.then.bind(p), catch: p.catch.bind(p) };
        },
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  workflows: Symbol("workflows"),
  workflowStages: Symbol("workflowStages"),
  proposalWorkflowState: Symbol("proposalWorkflowState"),
  approvalRecords: Symbol("approvalRecords"),
  proposals: Symbol("proposals"),
  projects: Symbol("projects"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

let uuidCounter = 0;
vi.mock("crypto", async () => {
  const actual = await vi.importActual("crypto");
  return {
    ...actual,
    randomUUID: () => `uuid-${++uuidCounter}`,
  };
});

import {
  createWorkflow,
  getWorkflow,
  getProjectWorkflow,
  assignProposalToWorkflow,
  getProposalState,
  advanceProposal,
  rejectProposal,
  getApprovalHistory,
} from "@/lib/workflow/engine";

beforeEach(() => {
  vi.resetAllMocks();
  uuidCounter = 0;
});

// ── Helpers ────────────────────────────────────────────────────────────────

const WORKFLOW_ROW = {
  id: "wf-1",
  projectId: "proj-1",
  name: "Default",
  description: null,
  stages: "[]",
  isDefault: 1,
};

const STAGE_ROWS = [
  { id: "s-1", workflowId: "wf-1", name: "Draft", description: "Initial", stageOrder: 0, allowedRoles: '["admin","manager","member"]', autoAdvance: 0, autoAdvanceAfter: null },
  { id: "s-2", workflowId: "wf-1", name: "Review", description: "Review", stageOrder: 1, allowedRoles: '["admin","manager"]', autoAdvance: 0, autoAdvanceAfter: null },
  { id: "s-3", workflowId: "wf-1", name: "Approved", description: "Done", stageOrder: 2, allowedRoles: '["admin"]', autoAdvance: 0, autoAdvanceAfter: null },
];

/**
 * Set up mocks so getWorkflow returns a valid workflow.
 * select-where-limit → workflow row, select-where-orderBy → stages
 */
function mockGetWorkflow(wfRow = WORKFLOW_ROW, stages = STAGE_ROWS) {
  mockSelectChain.mockImplementation((op: string) => {
    if (op === "select-where-limit") return [wfRow];
    if (op === "select-where-orderBy") return stages;
    return [];
  });
}

/**
 * Set up mocks for functions that first look up proposalWorkflowState then call getWorkflow.
 * The first select-where-limit returns the state row, subsequent ones return the workflow row.
 */
function mockProposalStateAndWorkflow(
  stateRow: Record<string, unknown>,
  wfRow = WORKFLOW_ROW,
  stages = STAGE_ROWS
) {
  let limitCallCount = 0;
  mockSelectChain.mockImplementation((op: string) => {
    if (op === "select-where-limit") {
      limitCallCount++;
      if (limitCallCount === 1) return [stateRow];
      return [wfRow];
    }
    if (op === "select-where-orderBy") return stages;
    return [];
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("workflow engine", () => {
  describe("createWorkflow", () => {
    it("creates a workflow with default stages", async () => {
      mockGetWorkflow({ ...WORKFLOW_ROW, id: "uuid-1" });
      const result = await createWorkflow("proj-1", "My Workflow");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Default");
      expect(mockInsertChain).toHaveBeenCalled();
    });

    it("creates a workflow with custom stages", async () => {
      mockGetWorkflow({ ...WORKFLOW_ROW, id: "uuid-1", isDefault: 0 }, [STAGE_ROWS[0]]);
      const custom = [{ name: "Idea", description: "Just an idea", allowedRoles: ["member"] }];
      const result = await createWorkflow("proj-1", "Custom", "desc", custom);
      expect(result).not.toBeNull();
      // insert called for workflow + 1 custom stage
      expect(mockInsertChain).toHaveBeenCalledTimes(2);
    });

    it("returns null on error", async () => {
      mockInsertChain.mockImplementation(() => { throw new Error("DB error"); });
      const result = await createWorkflow("proj-1", "Fail");
      expect(result).toBeNull();
    });
  });

  describe("getWorkflow", () => {
    it("returns workflow with parsed stages", async () => {
      mockGetWorkflow();
      const result = await getWorkflow("wf-1");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("wf-1");
      expect(result!.stages).toHaveLength(3);
      expect(result!.stages[0].allowedRoles).toEqual(["admin", "manager", "member"]);
      expect(result!.stages[1].name).toBe("Review");
    });

    it("returns null when not found", async () => {
      mockSelectChain.mockReturnValue([]);
      const result = await getWorkflow("nonexistent");
      expect(result).toBeNull();
    });

    it("returns null on error", async () => {
      mockSelectChain.mockImplementation(() => { throw new Error("DB error"); });
      const result = await getWorkflow("wf-1");
      expect(result).toBeNull();
    });
  });

  describe("getProjectWorkflow", () => {
    it("returns workflow for project", async () => {
      mockGetWorkflow();
      const result = await getProjectWorkflow("proj-1");
      expect(result).not.toBeNull();
      expect(result!.projectId).toBe("proj-1");
    });

    it("returns null when project has no workflow", async () => {
      mockSelectChain.mockReturnValue([]);
      const result = await getProjectWorkflow("proj-no-wf");
      expect(result).toBeNull();
    });
  });

  describe("assignProposalToWorkflow", () => {
    it("assigns proposal to first stage", async () => {
      mockGetWorkflow();
      const result = await assignProposalToWorkflow("prop-1", "wf-1");
      expect(result).not.toBeNull();
      expect(result!.proposalId).toBe("prop-1");
      expect(result!.currentStageId).toBe("s-1");
      expect(result!.currentStageName).toBe("Draft");
      expect(result!.status).toBe("active");
      expect(result!.stageIndex).toBe(0);
      expect(result!.totalStages).toBe(3);
    });

    it("returns null when workflow not found", async () => {
      mockSelectChain.mockReturnValue([]);
      const result = await assignProposalToWorkflow("prop-1", "bad-wf");
      expect(result).toBeNull();
    });

    it("uses onConflictDoUpdate for idempotency", async () => {
      mockGetWorkflow();
      await assignProposalToWorkflow("prop-1", "wf-1");
      expect(mockInsertChain).toHaveBeenCalled();
    });
  });

  describe("getProposalState", () => {
    it("returns current proposal state", async () => {
      mockProposalStateAndWorkflow({
        proposalId: "prop-1", workflowId: "wf-1", currentStageId: "s-2", status: "active",
      });

      const result = await getProposalState("prop-1");
      expect(result).not.toBeNull();
      expect(result!.currentStageName).toBe("Review");
      expect(result!.stageIndex).toBe(1);
      expect(result!.totalStages).toBe(3);
    });

    it("returns null when no state exists", async () => {
      mockSelectChain.mockReturnValue([]);
      const result = await getProposalState("prop-none");
      expect(result).toBeNull();
    });
  });

  describe("advanceProposal", () => {
    it("advances to next stage with correct role", async () => {
      // advanceProposal calls getProposalState (which calls getWorkflow) then getWorkflow again
      let limitCallCount = 0;
      mockSelectChain.mockImplementation((op: string) => {
        if (op === "select-where-limit") {
          limitCallCount++;
          if (limitCallCount === 1) {
            return [{ proposalId: "prop-1", workflowId: "wf-1", currentStageId: "s-1", status: "active" }];
          }
          return [WORKFLOW_ROW];
        }
        if (op === "select-where-orderBy") return STAGE_ROWS;
        return [];
      });

      const result = await advanceProposal("prop-1", "user-1", "manager", "Looks good");
      expect(result.success).toBe(true);
      expect(result.newStageName).toBe("Review");
      expect(result.newStageId).toBe("s-2");
    });

    it("completes workflow at final stage", async () => {
      let limitCallCount = 0;
      mockSelectChain.mockImplementation((op: string) => {
        if (op === "select-where-limit") {
          limitCallCount++;
          if (limitCallCount === 1) {
            return [{ proposalId: "prop-1", workflowId: "wf-1", currentStageId: "s-3", status: "active" }];
          }
          return [WORKFLOW_ROW];
        }
        if (op === "select-where-orderBy") return STAGE_ROWS;
        return [];
      });

      const result = await advanceProposal("prop-1", "user-1", "admin");
      expect(result.success).toBe(true);
      expect(result.newStageName).toBe("Completed");
    });

    it("rejects insufficient role", async () => {
      let limitCallCount = 0;
      mockSelectChain.mockImplementation((op: string) => {
        if (op === "select-where-limit") {
          limitCallCount++;
          if (limitCallCount === 1) {
            return [{ proposalId: "prop-1", workflowId: "wf-1", currentStageId: "s-3", status: "active" }];
          }
          return [WORKFLOW_ROW];
        }
        if (op === "select-where-orderBy") return STAGE_ROWS;
        return [];
      });

      // Stage s-3 (Approved) only allows "admin"
      const result = await advanceProposal("prop-1", "user-1", "member");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient role");
    });

    it("fails for non-active proposals", async () => {
      mockProposalStateAndWorkflow({
        proposalId: "prop-1", workflowId: "wf-1", currentStageId: "s-1", status: "completed",
      });

      const result = await advanceProposal("prop-1", "user-1", "admin");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not active");
    });

    it("fails when no workflow state exists", async () => {
      mockSelectChain.mockReturnValue([]);
      const result = await advanceProposal("prop-none", "user-1", "admin");
      expect(result.success).toBe(false);
      expect(result.error).toContain("No workflow state");
    });
  });

  describe("rejectProposal", () => {
    it("rejects proposal with correct role", async () => {
      let limitCallCount = 0;
      mockSelectChain.mockImplementation((op: string) => {
        if (op === "select-where-limit") {
          limitCallCount++;
          if (limitCallCount === 1) {
            return [{ proposalId: "prop-1", workflowId: "wf-1", currentStageId: "s-2", status: "active" }];
          }
          return [WORKFLOW_ROW];
        }
        if (op === "select-where-orderBy") return STAGE_ROWS;
        return [];
      });

      const result = await rejectProposal("prop-1", "user-1", "manager", "Not ready");
      expect(result.success).toBe(true);
      expect(result.newStageName).toBe("Rejected");
      expect(mockInsertChain).toHaveBeenCalled();
      expect(mockUpdateChain).toHaveBeenCalled();
    });

    it("fails with insufficient role", async () => {
      let limitCallCount = 0;
      mockSelectChain.mockImplementation((op: string) => {
        if (op === "select-where-limit") {
          limitCallCount++;
          if (limitCallCount === 1) {
            return [{ proposalId: "prop-1", workflowId: "wf-1", currentStageId: "s-2", status: "active" }];
          }
          return [WORKFLOW_ROW];
        }
        if (op === "select-where-orderBy") return STAGE_ROWS;
        return [];
      });

      const result = await rejectProposal("prop-1", "user-1", "member");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient role");
    });

    it("fails for non-active proposals", async () => {
      mockProposalStateAndWorkflow({
        proposalId: "prop-1", workflowId: "wf-1", currentStageId: "s-1", status: "rejected",
      });

      const result = await rejectProposal("prop-1", "user-1", "admin");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not active");
    });
  });

  describe("getApprovalHistory", () => {
    it("returns approval records in order", async () => {
      const records = [
        { id: "ar-1", stageId: "s-1", userId: "u-1", action: "approve", comment: "OK", createdAt: new Date() },
        { id: "ar-2", stageId: "s-2", userId: "u-2", action: "reject", comment: "No", createdAt: new Date() },
      ];
      mockSelectChain.mockReturnValue(records);

      const result = await getApprovalHistory("prop-1");
      expect(result).toHaveLength(2);
      expect(result[0].action).toBe("approve");
      expect(result[1].action).toBe("reject");
    });

    it("returns empty array on error", async () => {
      mockSelectChain.mockImplementation(() => { throw new Error("DB error"); });
      const result = await getApprovalHistory("prop-1");
      expect(result).toEqual([]);
    });
  });
});
