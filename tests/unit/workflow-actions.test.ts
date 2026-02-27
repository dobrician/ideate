/**
 * Unit tests for workflow server actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUser = { id: "user-1", email: "admin@test.com", role: "admin" };
const mockWithActionAuth = vi.fn();

vi.mock("@/lib/action-wrapper", () => ({
  withActionAuth: (...args: unknown[]) => mockWithActionAuth(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

const mockEngineCreate = vi.fn();
const mockGetProjectWorkflow = vi.fn();
const mockAssignProposalToWorkflow = vi.fn();
const mockAdvanceProposal = vi.fn();
const mockRejectProposal = vi.fn();

vi.mock("@/lib/workflow/engine", () => ({
  createWorkflow: (...args: unknown[]) => mockEngineCreate(...args),
  getProjectWorkflow: (...args: unknown[]) => mockGetProjectWorkflow(...args),
  assignProposalToWorkflow: (...args: unknown[]) => mockAssignProposalToWorkflow(...args),
  advanceProposal: (...args: unknown[]) => mockAdvanceProposal(...args),
  rejectProposal: (...args: unknown[]) => mockRejectProposal(...args),
}));

const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDbDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

vi.mock("@/db", () => ({
  db: {
    delete: (...args: unknown[]) => mockDbDelete(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  workflows: Symbol("workflows"),
  workflowStages: Symbol("workflowStages"),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import {
  createWorkflowAction,
  deleteWorkflowAction,
  assignWorkflowAction,
  advanceProposalAction,
  rejectProposalAction,
} from "@/app/admin/workflow-actions";

beforeEach(() => {
  vi.clearAllMocks();
  // Re-setup default mocks
  mockDbDelete.mockReturnValue({ where: mockDeleteWhere });
  mockDeleteWhere.mockResolvedValue(undefined);
  // Default: withActionAuth invokes the callback with the mock user
  mockWithActionAuth.mockImplementation(async (_csrf: string, _opts: unknown, cb: (user: typeof mockUser) => Promise<unknown>) => {
    return cb(mockUser);
  });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("workflow server actions", () => {
  describe("createWorkflowAction", () => {
    it("creates workflow successfully", async () => {
      mockGetProjectWorkflow.mockResolvedValue(null);
      mockEngineCreate.mockResolvedValue({ id: "wf-1", stages: [{ name: "Draft" }] });

      const result = await createWorkflowAction(
        "proj-1", "My Flow", [{ name: "Draft" }], "csrf-token"
      );
      expect(result.success).toBe(true);
      expect(mockEngineCreate).toHaveBeenCalledWith("proj-1", "My Flow", undefined, [{ name: "Draft" }]);
    });

    it("rejects empty name", async () => {
      const result = await createWorkflowAction("proj-1", "", [], "csrf");
      expect(result.error).toBe("Workflow name is required");
    });

    it("rejects empty stages", async () => {
      const result = await createWorkflowAction("proj-1", "Name", [], "csrf");
      expect(result.error).toBe("At least one stage is required");
    });

    it("rejects if project already has workflow", async () => {
      mockGetProjectWorkflow.mockResolvedValue({ id: "wf-existing" });
      const result = await createWorkflowAction("proj-1", "Name", [{ name: "Draft" }], "csrf");
      expect(result.error).toBe("Project already has a workflow");
    });
  });

  describe("deleteWorkflowAction", () => {
    it("deletes workflow successfully", async () => {
      const result = await deleteWorkflowAction("wf-1", "csrf");
      expect(result.success).toBe(true);
      expect(mockDbDelete).toHaveBeenCalledTimes(2); // stages + workflow
    });
  });

  describe("assignWorkflowAction", () => {
    it("assigns workflow to proposal", async () => {
      mockAssignProposalToWorkflow.mockResolvedValue({
        proposalId: "p-1", currentStageName: "Draft",
      });
      const result = await assignWorkflowAction("p-1", "wf-1", "csrf");
      expect(result.success).toBe(true);
    });

    it("returns error on failure", async () => {
      mockAssignProposalToWorkflow.mockResolvedValue(null);
      const result = await assignWorkflowAction("p-1", "wf-bad", "csrf");
      expect(result.error).toBe("Failed to assign workflow");
    });
  });

  describe("advanceProposalAction", () => {
    it("advances proposal", async () => {
      mockAdvanceProposal.mockResolvedValue({ success: true, newStageName: "Review" });
      const result = await advanceProposalAction("p-1", "Looks good", "csrf");
      expect(result.success).toBe(true);
      expect(result.stageName).toBe("Review");
    });

    it("returns engine error", async () => {
      mockAdvanceProposal.mockResolvedValue({ success: false, error: "Insufficient role" });
      const result = await advanceProposalAction("p-1", undefined, "csrf");
      expect(result.error).toBe("Insufficient role");
    });
  });

  describe("rejectProposalAction", () => {
    it("rejects proposal", async () => {
      mockRejectProposal.mockResolvedValue({ success: true, newStageName: "Rejected" });
      const result = await rejectProposalAction("p-1", "Not ready", "csrf");
      expect(result.success).toBe(true);
    });

    it("returns engine error", async () => {
      mockRejectProposal.mockResolvedValue({ success: false, error: "Not active" });
      const result = await rejectProposalAction("p-1", undefined, "csrf");
      expect(result.error).toBe("Not active");
    });
  });
});
