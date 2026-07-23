import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Modal, ModalBanner } from "./Modal";
import { Button } from "./ui/button";

describe("Modal", () => {
  it("renders title, children and footer when open", () => {
    render(
      <Modal
        open
        onOpenChange={vi.fn<(...args: any[]) => any>()}
        title="New Trade"
        footer={
          <Button type="button" variant="default">
            Save
          </Button>
        }
      >
        <ModalBanner>Log any trade.</ModalBanner>
        <p>Body</p>
      </Modal>,
    );
    expect(screen.getByText("New Trade")).toBeInTheDocument();
    expect(screen.getByText("Log any trade.")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onOpenChange={vi.fn<(...args: any[]) => any>()} title="Hidden">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});
