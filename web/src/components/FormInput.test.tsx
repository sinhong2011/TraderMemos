import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { PasswordInput } from "./FormInput";

describe("PasswordInput", () => {
  it("toggles between password and text", async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Secret" defaultValue="sk-secret" />);

    const input = screen.getByLabelText("Secret");
    expect(input).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show value" }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide value" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Hide value" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("shows clear action and calls onClear", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn<(...args: any[]) => any>();
    render(
      <PasswordInput aria-label="Secret" value="sk-secret" onChange={() => {}} onClear={onClear} />,
    );

    await user.click(screen.getByRole("button", { name: "Clear value" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
