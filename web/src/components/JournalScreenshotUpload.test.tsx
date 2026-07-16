import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { JournalScreenshotUpload, fileToScreenshotItem } from "./JournalScreenshotUpload";

describe("JournalScreenshotUpload", () => {
  it("renders add control and lists pending screenshots with previews", async () => {
    const onAddFiles = vi.fn<(files: File[]) => void>();
    const onRemove = vi.fn();
    const file = new File(["pixels"], "chart.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 2048 });

    const { rerender } = render(
      <JournalScreenshotUpload
        items={[]}
        onAddFiles={onAddFiles}
        inputTestId="journal-screenshot-input"
      />,
    );

    expect(screen.getByText("Add screenshots")).toBeInTheDocument();
    const input = screen.getByTestId("journal-screenshot-input");
    fireEvent.change(input, { target: { files: [file] } });
    expect(onAddFiles).toHaveBeenCalledWith([file]);

    rerender(
      <JournalScreenshotUpload
        items={[fileToScreenshotItem(file, onRemove)]}
        onAddFiles={onAddFiles}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "chart.png" })).toBeInTheDocument();
    });
    expect(screen.getByText("chart.png")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Remove chart.png"));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("keeps the same blob URL across parent re-renders", async () => {
    const file = new File(["pixels"], "chart.png", { type: "image/png" });
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-preview");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const { rerender } = render(
      <JournalScreenshotUpload
        items={[fileToScreenshotItem(file, vi.fn())]}
        onAddFiles={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "chart.png" })).toHaveAttribute(
        "src",
        "blob:test-preview",
      );
    });
    expect(create).toHaveBeenCalledTimes(1);

    rerender(
      <JournalScreenshotUpload
        items={[fileToScreenshotItem(file, vi.fn())]}
        onAddFiles={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: "chart.png" })).toHaveAttribute(
      "src",
      "blob:test-preview",
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();

    create.mockRestore();
    revoke.mockRestore();
  });

  it("disables picker when max count is reached", async () => {
    render(
      <JournalScreenshotUpload
        items={[
          {
            key: "a",
            name: "a.png",
            sizeBytes: 100,
          },
        ]}
        onAddFiles={vi.fn()}
        maxCount={1}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Maximum 1 screenshots")).toBeInTheDocument();
    });
  });

  it("opens a zoom preview when clicking a screenshot", async () => {
    const file = new File(["pixels"], "chart.png", { type: "image/png" });
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-preview");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    render(
      <JournalScreenshotUpload
        items={[fileToScreenshotItem(file, vi.fn())]}
        onAddFiles={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Preview chart.png")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Preview chart.png"));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    create.mockRestore();
    revoke.mockRestore();
  });
});
