// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ProposalFormFields } from "@/components/proposal-form-fields";
import { useProposalForm } from "@/lib/use-proposal-form";
import { getTranslations } from "@/lib/i18n";

vi.mock("@/lib/use-locale", () => ({ useLocale: () => getTranslations("en") }));
vi.mock("@/lib/csrf-client", () => ({ getCsrfTokenClient: () => "csrf" }));
vi.mock("@/app/projects/[id]/proposals/actions", () => ({ createProposal: vi.fn(async () => ({ success: true })) }));

function Fields() {
  const form = useProposalForm({ projectId: "demo", availableTags: [{ id: "tag", name: "Automation" }] });
  return <ProposalFormFields form={form} />;
}

describe("ProposalFormFields", () => {
  it("should validate the required idea before submitting", async () => {
    const user = userEvent.setup();
    render(<Fields />);
    await user.click(screen.getByRole("button", { name: "Submit Proposal" }));
    expect(screen.getByText("Proposal title is required")).toBeVisible();
    await user.type(screen.getByLabelText("Title"), "Idea");
    expect(screen.getByText("Title must be at least 5 characters")).toBeVisible();
  });
  it("should reveal categories intentionally and keep the initial vote explicit", async () => {
    const user = userEvent.setup();
    render(<Fields />);
    expect(screen.getByRole("button", { name: "Pro", hidden: false })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Contra" }));
    expect(screen.getByRole("button", { name: "Contra" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Automation")).not.toBeVisible();
    await user.click(screen.getByText("Tags"));
    await user.click(screen.getByRole("button", { name: "Automation" }));
    expect(screen.getByRole("button", { name: "Automation" })).toHaveAttribute("aria-pressed", "true");
  });
});
