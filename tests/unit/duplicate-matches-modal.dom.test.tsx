// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { DuplicateMatchesModal } from "@/components/duplicate-matches-modal";
import type { useProposalForm } from "@/lib/use-proposal-form";
import { getTranslations } from "@/lib/i18n";

vi.mock("@/lib/csrf-client", () => ({ getCsrfTokenClient: () => "csrf" }));
vi.mock("@/app/projects/[id]/proposals/actions", () => ({ castVote: vi.fn(async () => ({ success: true })) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function form(): ReturnType<typeof useProposalForm> {
  return {
    ...getTranslations("en"), state: null, isPending: false, initialVote: "1",
    setInitialVote: vi.fn(), title: "Idea", setTitle: vi.fn(), description: "", setDescription: vi.fn(),
    submitWithDuplicateCheck: vi.fn(), resetForm: vi.fn(), projectId: "demo", availableTags: [],
    selectedTagIds: [], setSelectedTagIds: vi.fn(), modalState: "matches", modalOpen: true,
    duplicateMatches: [{ id: "one", similarity: 80, explanation: "Same improvement" }],
    confirmSubmitWithVote: vi.fn(), cancelDuplicateModal: vi.fn(),
    existingById: new Map([["one", { id: "one", title: "Existing idea" }]]),
  };
}

describe("DuplicateMatchesModal", () => {
  it.each(["1", "-1"] as const)("should require explicit confirmation before saving another idea with vote %s", async vote => {
    const user = userEvent.setup();
    const data = form();
    render(<DuplicateMatchesModal form={data} projectId="demo" />);
    await user.click(screen.getByRole("button", { name: data.t(vote === "1" ? "duplicateModal.addAnywayPro" : "duplicateModal.addAnywayContra") }));
    expect(data.confirmSubmitWithVote).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: data.t("duplicateModal.confirmAddYes") }));
    expect(data.confirmSubmitWithVote).toHaveBeenCalledWith(vote);
  });
  it("should allow cancellation while checking similarity and prevent cancellation while saving", async () => {
    const user = userEvent.setup();
    const data = form();
    const { rerender } = render(<DuplicateMatchesModal form={{ ...data, modalState: "validating" }} projectId="demo" />);
    expect(screen.getByRole("dialog")).toHaveAccessibleName(data.t("duplicateModal.validating"));
    await user.click(screen.getByRole("button", { name: data.t("duplicateModal.cancel") }));
    expect(data.cancelDuplicateModal).toHaveBeenCalledOnce();
    rerender(<DuplicateMatchesModal form={{ ...data, modalState: "saving" }} projectId="demo" />);
    expect(screen.getByRole("dialog")).toHaveAccessibleName(data.t("duplicateModal.saving"));
    expect(screen.getByRole("button", { name: data.t("duplicateModal.cancel") })).toBeDisabled();
  });
  it("should show an existing idea and allow voting without creating a duplicate", async () => {
    const user = userEvent.setup();
    const data = form();
    render(<DuplicateMatchesModal form={data} projectId="demo" />);
    expect(screen.getByRole("link", { name: "Existing idea" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Pro", exact: true }));
    expect(await screen.findByLabelText("You voted Pro")).toBeVisible();
    expect(data.confirmSubmitWithVote).not.toHaveBeenCalled();
  });
  it("should omit the dialog when duplicate review is closed", () => {
    render(<DuplicateMatchesModal form={{ ...form(), modalOpen: false, modalState: "closed" }} projectId="demo" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
