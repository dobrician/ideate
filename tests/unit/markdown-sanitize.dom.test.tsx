// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MarkdownRenderer } from "@/components/markdown-renderer";

describe("MarkdownRenderer sanitization", () => {
  it("does not render raw HTML script tags", () => {
    const { container } = render(
      <MarkdownRenderer content={'<script>alert("xss")</script> hello'} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container).toHaveTextContent("hello");
  });

  it("does not render dangerous img onerror attributes", () => {
    const { container } = render(
      <MarkdownRenderer content={'<img src="x" onerror="alert(1)">text'} />,
    );
    const img = container.querySelector("img");
    if (img) {
      expect(img.getAttribute("onerror")).toBeNull();
    }
    expect(container).toHaveTextContent("text");
  });

  it("renders GFM tables", () => {
    const table = "| A | B |\n|---|---|\n| 1 | 2 |";
    const { container } = render(<MarkdownRenderer content={table} />);
    expect(container.querySelector("table")).not.toBeNull();
    expect(container).toHaveTextContent("1");
    expect(container).toHaveTextContent("2");
  });

  it("renders strikethrough with GFM", () => {
    render(<MarkdownRenderer content="~~deleted~~" />);
    const del = screen.getByText("deleted");
    expect(del.tagName).toBe("DEL");
  });

  it("renders task lists with GFM", () => {
    const { container } = render(
      <MarkdownRenderer content={"- [x] done\n- [ ] todo"} />,
    );
    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    expect(checkboxes.length).toBe(2);
  });

  it("handles empty content gracefully", () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container).toBeInTheDocument();
  });

  it("renders code blocks", () => {
    const { container } = render(
      <MarkdownRenderer content={"```\nconst x = 1;\n```"} />,
    );
    expect(container.querySelector("code")).not.toBeNull();
    expect(container).toHaveTextContent("const x = 1;");
  });
});
