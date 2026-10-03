// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ProposalAttachments } from "@/components/proposal-attachments";
import type { ProposalWithStats } from "@/components/proposal-item";
vi.mock("@/lib/use-locale", () => ({ useLocale: () => ({ t: () => "Attachments" }) }));
vi.mock("@/components/attachment-upload", () => ({ AttachmentUpload: ({ canEdit }: { canEdit: boolean }) => <div>{canEdit ? "Upload files" : "Read files"}</div> }));
const proposal: ProposalWithStats = {
  id: "idea", title: "A customer portal", description: null, summary: null,
  userId: "owner", createdAt: null, upvotes: 1, downvotes: 0, userVote: null,
  commentCount: 0, comments: [], authorName: "Ana", tags: [],
  attachments: [{ id: "file", filename: "plan.pdf", mimeType: "application/pdf", size: 50 }],
};
describe("ProposalAttachments", () => {
  it.each([true, false])("should reveal files intentionally and preserve edit permission %s", async canEdit => {
    render(<ProposalAttachments proposal={proposal} canEdit={canEdit} />);
    expect(screen.queryByText("A customer portal")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Attachments" }));
    expect(screen.getByText("A customer portal")).toBeVisible();
    expect(screen.getByText(canEdit ? "Upload files" : "Read files")).toBeVisible();
  });
});
