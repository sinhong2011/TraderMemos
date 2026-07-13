import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { RouteErrorPanel } from "./RouteErrorPanel";

describe("RouteErrorPanel", () => {
  it("shows the error message and a reload action", () => {
    render(<RouteErrorPanel error={new Error("StatCard is not defined")} />);
    expect(screen.getByText("Screen error")).toBeInTheDocument();
    expect(screen.getByText("StatCard is not defined")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });
});
