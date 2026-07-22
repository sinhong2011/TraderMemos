import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("renders range and navigates pages", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <Pagination page={1} pageCount={3} total={60} pageSize={25} onPageChange={onPageChange} />,
    );

    expect(screen.getByText("1–25 of 60")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(2);

    await user.click(screen.getByRole("button", { name: "Page 3" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("disables previous on first page", () => {
    render(<Pagination page={1} pageCount={2} total={40} pageSize={25} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).not.toBeDisabled();
  });

  it("changes page size", async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        page={1}
        pageCount={1}
        total={20}
        pageSize={25}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
        alwaysShow
      />,
    );

    await user.selectOptions(screen.getByLabelText("Rows per page"), "10");
    expect(onPageSizeChange).toHaveBeenCalledWith(10);
  });
});
