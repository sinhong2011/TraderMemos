import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { CsvDropZone } from "./CsvDropZone";

describe("CsvDropZone", () => {
  it("renders drop zone when no file selected", () => {
    render(<CsvDropZone file={null} onFileChange={vi.fn<(...args: any[]) => any>()} />);
    expect(screen.getByText(/Click to upload/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Import file input")).toBeInTheDocument();
  });

  it("shows selected file chip", () => {
    const file = new File(["a,b\n1,2"], "trades.csv", { type: "text/csv" });
    render(<CsvDropZone file={file} onFileChange={vi.fn<(...args: any[]) => any>()} />);
    expect(screen.getByText("trades.csv")).toBeInTheDocument();
  });

  it("clears file when remove is clicked", async () => {
    const user = userEvent.setup();
    const onFileChange = vi.fn<(...args: any[]) => any>();
    const file = new File(["a,b\n1,2"], "trades.csv", { type: "text/csv" });
    render(<CsvDropZone file={file} onFileChange={onFileChange} />);
    await user.click(screen.getByRole("button", { name: /remove file/i }));
    expect(onFileChange).toHaveBeenCalledWith(null);
  });
});
