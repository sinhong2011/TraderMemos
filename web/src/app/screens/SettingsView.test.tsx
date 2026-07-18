import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, beforeEach, vi } from "vite-plus/test";
import { Toaster } from "../../components/Toaster";
import type { Account, CashTransaction, Setup, Tag } from "../../lib/api/types";
import { renderWithI18n } from "../../test/renderWithI18n";
import { DEFAULT_LOCALE, setStoredLocale } from "../../lib/locale";
import { SettingsView } from "./SettingsView";

function renderSettings(props: ComponentProps<typeof SettingsView>) {
  return renderWithI18n(
    <Toaster>
      <SettingsView {...props} />
    </Toaster>,
  );
}

vi.mock("../../lib/hooks/useTrades", () => ({
  useTrades: () => ({ data: [], isLoading: false, isError: false }),
}));

const noop = async () => {};

const accounts: Account[] = [
  {
    id: "a1",
    user_id: "u1",
    name: "Main",
    broker: "IBKR",
    account_type: "margin",
    base_currency: "USD",
    starting_balance: 10000,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const cashTransactions: CashTransaction[] = [];
const tags: Tag[] = [];
const setups: Setup[] = [];

const baseProps = {
  accounts,
  accountsLoading: false,
  accountsError: false,
  onCreateAccount: vi.fn(noop),
  onDeleteAccount: vi.fn(noop),
  onClearAccountTrades: vi.fn(noop),

  cashTransactions,
  cashLoading: false,
  cashError: false,
  onCreateCash: vi.fn(noop),
  onDeleteCash: vi.fn(noop),

  tags,
  tagsLoading: false,
  tagsError: false,
  onCreateTag: vi.fn(noop),
  onDeleteTag: vi.fn(noop),

  setups,
  setupsLoading: false,
  setupsError: false,
  onCreateSetup: vi.fn(noop),
  onDeleteSetup: vi.fn(noop),

  riskRules: {
    max_risk_per_trade: null,
    max_daily_loss: null,
    max_open_risk: null,
    default_account_risk_pct: 1,
  },
  riskRulesLoading: false,
  riskRulesError: false,
  riskRulesSaving: false,
  onSaveRiskRules: vi.fn(noop),

  checklistItems: ["Check VIX"],
  checklistLoading: false,
  checklistError: false,
  checklistSaving: false,
  onSaveChecklist: vi.fn(noop),
};

describe("SettingsView", () => {
  beforeEach(() => {
    setStoredLocale(DEFAULT_LOCALE);
    window.location.hash = "#accounts";
  });

  it("marks the only account as primary and hides delete", async () => {
    renderSettings({ ...baseProps });
    expect(await screen.findByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("$10,000.00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete main/i })).not.toBeInTheDocument();
  });

  it("allows deleting a secondary account when two exist", () => {
    const second: Account = {
      ...accounts[0],
      id: "a2",
      name: "Paper",
      created_at: "2026-02-01T00:00:00Z",
    };
    renderSettings({ ...baseProps, accounts: [...accounts, second] });
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete paper/i })).toBeInTheDocument();
  });

  it("opens the rules tab from the URL hash", () => {
    window.location.hash = "#rules";
    renderSettings({ ...baseProps });
    expect(screen.getByText("Risk Rules")).toBeInTheDocument();
  });

  it("renders the language select on the general tab", async () => {
    window.location.hash = "#general";
    renderSettings({ ...baseProps });
    expect(await screen.findByRole("combobox", { name: /language selector/i })).toBeInTheDocument();
  });

  it("shows all supported language options on the general tab", async () => {
    const user = userEvent.setup();
    window.location.hash = "#general";
    renderSettings({ ...baseProps });
    await user.click(await screen.findByRole("combobox", { name: /language selector/i }));
    const listbox = await screen.findByRole("listbox");
    expect(listbox).toHaveTextContent("English");
    expect(listbox).toHaveTextContent("繁體中文（香港）");
    expect(listbox).toHaveTextContent("日本語");
    expect(listbox).toHaveTextContent("한국어");
  });

  it("updates settings labels when language changes", async () => {
    const user = userEvent.setup();
    window.location.hash = "#general";
    renderSettings({ ...baseProps });
    await user.click(await screen.findByRole("combobox", { name: /language selector/i }));
    await user.click(await screen.findByRole("option", { name: "日本語" }));
    expect(await screen.findByRole("link", { name: /^一般$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "一般", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("言語")).toBeInTheDocument();
  });

  it("shows empty state for cash when no transactions", () => {
    renderSettings({ ...baseProps });
    expect(screen.getByText("No transactions yet")).toBeInTheDocument();
  });

  it("opens deposit form prefilled from account row shortcut", async () => {
    const user = userEvent.setup();
    renderSettings({ ...baseProps });
    await user.click(screen.getByRole("button", { name: /deposit to main/i }));
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByText("Filtered to Main")).toBeInTheDocument();
  });

  it("shows empty state for tags when no tags", async () => {
    const user = userEvent.setup();
    renderSettings({ ...baseProps });
    await user.click(screen.getByRole("link", { name: /^Journal$/i }));
    expect(screen.getByText("No tags yet")).toBeInTheDocument();
  });

  it("renders risk rules section on the rules tab", async () => {
    const user = userEvent.setup();
    renderSettings({ ...baseProps });
    await user.click(screen.getByRole("link", { name: /^Rules$/i }));
    expect(screen.getByText("Risk Rules")).toBeInTheDocument();
    expect(screen.getByLabelText(/max risk per trade/i)).toBeInTheDocument();
  });

  it("shows empty state for setups when none", async () => {
    const user = userEvent.setup();
    renderSettings({ ...baseProps });
    await user.click(screen.getByRole("link", { name: /^Journal$/i }));
    expect(screen.getByText("No setups yet")).toBeInTheDocument();
  });

  it("renders accounts section header", () => {
    renderSettings({ ...baseProps });
    expect(screen.getByRole("heading", { name: "Accounts", level: 2 })).toBeInTheDocument();
  });

  it("shows loading skeleton for accounts", () => {
    const { container } = renderSettings({
      ...baseProps,
      accountsLoading: true,
      accounts: [],
    });
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("exposes bookmarkable section links", () => {
    renderSettings({ ...baseProps });
    expect(screen.getByRole("link", { name: /^Rules$/i })).toHaveAttribute("href", "#rules");
  });
});
