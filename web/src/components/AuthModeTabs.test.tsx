import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { AuthModeTabs } from "./AuthModeTabs";

const OPTIONS = [
  { value: "login", label: "Sign in" },
  { value: "register", label: "Create account" },
] as const;

describe("AuthModeTabs", () => {
  it("selects the active tab and fires onChange", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <AuthModeTabs options={OPTIONS} value="login" onChange={onChange} />,
    );

    expect(screen.getByRole("tab", { name: "Sign in" })).toHaveAttribute("aria-selected", "true");
    expect(container.querySelector('[role="tablist"]')).toHaveClass("justify-center");
    await userEvent.click(screen.getByRole("tab", { name: "Create account" }));
    expect(onChange).toHaveBeenCalledWith("register");
  });
});
