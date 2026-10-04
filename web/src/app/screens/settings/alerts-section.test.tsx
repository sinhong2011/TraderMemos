import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Toaster } from "@/components/Toaster";
import type { AlertSettings } from "@/lib/api/alerts";
import { renderWithI18n } from "@/test/renderWithI18n";
import { AlertsSection } from "./alerts-section";

const h = vi.hoisted(() => ({
  settings: null as AlertSettings | null,
  mutate: vi.fn<(body: AlertSettings) => void>(),
}));

vi.mock("@/lib/hooks/useAlerts", () => ({
  useAlertSettings: () => ({ data: h.settings, isLoading: false, isError: false }),
  useSaveAlertSettings: () => ({ mutate: h.mutate, isPending: false }),
  useAlertChannels: () => ({ data: [], isLoading: false, isError: false }),
  useCreateWebhookChannel: () => ({
    mutateAsync: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    isPending: false,
  }),
  useSetAlertChannelEnabled: () => ({ mutate: () => {}, isPending: false }),
  useDeleteAlertChannel: () => ({ mutate: () => {}, isPending: false }),
  useTestAlertChannel: () => ({
    mutateAsync: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    isPending: false,
  }),
  useAlertEvents: () => ({ data: [], isLoading: false, isError: false }),
}));

function settings(patch: Partial<AlertSettings> = {}): AlertSettings {
  return {
    enabled: true,
    timezone: "America/New_York",
    rule_risk: true,
    rule_daily_loss: true,
    rule_loss_streak: true,
    loss_streak_n: 3,
    rule_prop_drawdown: true,
    prop_warn_pct: 0.8,
    rule_unreviewed: true,
    unreviewed_days: 7,
    rule_weekly_review: true,
    ...patch,
  };
}

function renderSection() {
  return renderWithI18n(
    <Toaster>
      <AlertsSection />
    </Toaster>,
  );
}

describe("AlertsSection weekly review", () => {
  beforeEach(() => {
    h.mutate.mockReset();
  });

  it("shows the toggle on and saves it off with the rest of the settings", async () => {
    h.settings = settings();
    const user = userEvent.setup();
    renderSection();

    expect(screen.getByText("Weekly review")).toBeInTheDocument();
    const toggle = screen.getByRole("switch", { name: "Weekly review alerts" });
    expect(toggle).toBeChecked();

    await user.click(toggle);
    expect(h.mutate).toHaveBeenCalledTimes(1);
    expect(h.mutate.mock.calls[0]?.[0]).toEqual(settings({ rule_weekly_review: false }));
  });

  it("turns it back on from off", async () => {
    h.settings = settings({ rule_weekly_review: false });
    const user = userEvent.setup();
    renderSection();

    const toggle = screen.getByRole("switch", { name: "Weekly review alerts" });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(h.mutate.mock.calls[0]?.[0]).toEqual(settings({ rule_weekly_review: true }));
  });

  it("is disabled while alerts are off", () => {
    h.settings = settings({ enabled: false });
    renderSection();
    expect(screen.getByRole("switch", { name: "Weekly review alerts" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
