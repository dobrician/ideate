// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MarkdownRenderer } from "@/components/markdown-renderer";

describe("MarkdownRenderer", () => {
  it("renders headings and bold in default mode", () => {
    render(<MarkdownRenderer content={"## Hello **world**"} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Hello world");
    expect(heading.querySelector("strong")).not.toBeNull();
  });

  it("renders links in default mode", () => {
    render(<MarkdownRenderer content="[click](https://example.com)" />);
    const link = screen.getByRole("link", { name: "click" });
    expect(link).toHaveAttribute("href", "https://example.com");
  });

  it("renders lists in default mode", () => {
    render(<MarkdownRenderer content={"- one\n- two"} />);
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(1);
  });

  it("unwraps block elements in simple mode", () => {
    const { container } = render(
      <MarkdownRenderer content="## Heading\n\n- item" simple />,
    );
    expect(container.querySelector("h2")).toBeNull();
    expect(container.querySelector("ul")).toBeNull();
    expect(container.querySelector("li")).toBeNull();
    // Text content is still present, just unwrapped
    expect(container).toHaveTextContent("Heading");
    expect(container).toHaveTextContent("item");
  });

  it("keeps inline elements in simple mode", () => {
    render(<MarkdownRenderer content="**bold** and *italic*" simple />);
    const bold = screen.getByText("bold");
    expect(bold.tagName).toBe("STRONG");
  });

  it("keeps links in simple mode", () => {
    render(<MarkdownRenderer content="[link](https://x.com)" simple />);
    expect(screen.getByRole("link", { name: "link" })).toHaveAttribute("href", "https://x.com");
  });

  it("applies custom className", () => {
    const { container } = render(
      <MarkdownRenderer content="hello" className="my-class" />,
    );
    expect(container.firstChild).toHaveClass("my-class");
  });
});
