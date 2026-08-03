import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import type { ReplayPnl } from "./replayPnl";
import { ReplayControls } from "./ReplayControls";
import type { ReplayController } from "./useReplayController";

function controller(overrides: Partial<ReplayController> = {}): ReplayController {
  return {
    active: true,
    cursor: 3,
    playing: false,
    speed: "2",
    start: vi.fn<() => void>(),
    exit: vi.fn<() => void>(),
    toggle: vi.fn<() => void>(),
    stepBack: vi.fn<() => void>(),
    stepForward: vi.fn<() => void>(),
    seek: vi.fn<(i: number) => void>(),
    setSpeed: vi.fn<() => void>(),
    ...overrides,
  };
}

const pnl: ReplayPnl = {
  position: 100,
  avgCost: 10,
  realized: 0,
  unrealized: 150,
  fees: 2,
  net: 148,
  fillCount: 1,
};

describe("ReplayControls", () => {
  it("shows transport controls, the bar time, position, and running P&L", () => {
    render(
      <ReplayControls
        controller={controller()}
        barCount={10}
        timeLabel="Jul 15, 14:30"
        pnl={pnl}
        fillTotal={2}
        currency="USD"
      />,
    );
    expect(screen.getByLabelText("Play replay")).toBeInTheDocument();
    expect(screen.getByLabelText("Step back")).toBeInTheDocument();
    expect(screen.getByLabelText("Step forward")).toBeInTheDocument();
    expect(screen.getByLabelText("Replay position")).toBeInTheDocument();
    expect(screen.getByText("Jul 15, 14:30")).toBeInTheDocument();
    expect(screen.getByText("Long 100")).toBeInTheDocument();
    expect(screen.getByText("+$148.00")).toBeInTheDocument();
  });

  it("labels the transport Pause while playing and shows Flat / losses correctly", () => {
    render(
      <ReplayControls
        controller={controller({ playing: true })}
        barCount={10}
        timeLabel="Jul 15, 14:30"
        pnl={{ ...pnl, position: 0, unrealized: 0, net: -2 }}
        fillTotal={2}
        currency="USD"
      />,
    );
    expect(screen.getByLabelText("Pause replay")).toBeInTheDocument();
    expect(screen.getByText("Flat")).toBeInTheDocument();
    expect(screen.getByText("-$2.00")).toBeInTheDocument();
  });

  it("labels a zero position Closed once every fill is consumed", () => {
    render(
      <ReplayControls
        controller={controller()}
        barCount={10}
        timeLabel="Jul 15, 15:58"
        pnl={{ ...pnl, position: 0, unrealized: 0, net: 123.41, fillCount: 2 }}
        fillTotal={2}
        currency="USD"
      />,
    );
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.queryByText("Flat")).not.toBeInTheDocument();
  });

  it("shows the price-mismatch hint only when flagged", () => {
    const { rerender } = render(
      <ReplayControls
        controller={controller()}
        barCount={10}
        timeLabel="Jul 15, 14:30"
        pnl={pnl}
        fillTotal={2}
        currency="USD"
        priceMismatch
      />,
    );
    expect(screen.getByText(/Chart data disagrees/)).toBeInTheDocument();
    rerender(
      <ReplayControls
        controller={controller()}
        barCount={10}
        timeLabel="Jul 15, 14:30"
        pnl={pnl}
        fillTotal={2}
        currency="USD"
      />,
    );
    expect(screen.queryByText(/Chart data disagrees/)).not.toBeInTheDocument();
  });

  it("wires the transport buttons to the controller", async () => {
    const c = controller();
    const user = userEvent.setup();
    render(
      <ReplayControls
        controller={c}
        barCount={10}
        timeLabel="Jul 15, 14:30"
        pnl={pnl}
        fillTotal={2}
        currency="USD"
      />,
    );
    await user.click(screen.getByLabelText("Play replay"));
    expect(c.toggle).toHaveBeenCalled();
    await user.click(screen.getByLabelText("Step forward"));
    expect(c.stepForward).toHaveBeenCalled();
    await user.click(screen.getByLabelText("Step back"));
    expect(c.stepBack).toHaveBeenCalled();
  });
});
