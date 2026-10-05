import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { WeeklyFocusCard } from "./WeeklyFocusCard";

describe("WeeklyFocusCard", () => {
  it("lists the week's focus in order", () => {
    render(<WeeklyFocusCard items={["Wait for the retest", "Stop after two losses"]} />);
    expect(screen.getByText("This week's focus")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["1Wait for the retest", "2Stop after two losses"]);
  });

  it("renders nothing without a focus", () => {
    const { container } = render(<WeeklyFocusCard items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens the review that set it", async () => {
    const onOpenReview = vi.fn<() => void>();
    render(<WeeklyFocusCard items={["Size down on Mondays"]} onOpenReview={onOpenReview} />);
    await userEvent.click(screen.getByRole("button", { name: "From your weekly review" }));
    expect(onOpenReview).toHaveBeenCalledTimes(1);
  });
});
