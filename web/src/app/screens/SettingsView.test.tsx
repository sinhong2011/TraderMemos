import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, beforeEach, vi } from "vite-plus/test";
import { Toaster } from "../../components/Toaster";
import type { Account, CashTransaction, Tag } from "../../lib/api/types";
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

vi.mock("../../lib/hooks/useOcrSettings", () => ({
  useOcrSettings: () => ({
    data: {
      enabled: false,
      base_url: "",
      model: "",
      api_key_set: false,
      api_key_hint: "",
      custom_prompt: "",
      default_prompt: "",
    },
    isPending: false,
    isError: false,
  }),
  useSaveOcrSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTestOcrSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useListOcrModels: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../../lib/hooks/useCoachSettings", () => ({
  useCoachSettings: () => ({
    data: {
      enabled: false,
      base_url: "",
      model: "",
      api_key_set: false,
      api_key_hint: "",
      custom_prompt: "",
      default_prompt: "",
    },
    isPending: false,
    isError: false,
  }),
  useSaveCoachSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTestCoachSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useListCoachModels: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../../lib/hooks/useApiHealth", () => ({
  useApiHealth: () => ({
    data: { status: "ok", version: "0.1.0", go: "go1.26.1" },
    isPending: false,
    isSuccess: true,
    isError: false,
  }),
}));

vi.mock("../../lib/hooks/useAccessTokens", () => ({
  useAccessTokens: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
  useCreateAccessToken: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRevokeAccessToken: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

const cashTransactions: CashTransaction[] = [
  {
    id: "c1",
    user_id: "u1",
    account_id: "a1",
    type: "deposit",
    amount: 10000,
    currency: "USD",
    occurred_at: "2026-01-01T00:00:00Z",
    note: "Opening balance",
    trade_id: null,
    created_at: "2026-01-01T00:00:00Z",
  },
];
const tags: Tag[] = [];

const baseProps = {
  accounts,
  accountsLoading: false,
  accountsError: false,
  onCreateAccount: vi.fn(noop),
  onDeleteAccount: vi.fn(noop),
  onUpdateAccount: vi.fn(noop),
  onClearAccountTrades: vi.fn(noop),

  cashTransactions,
  cashLoading: false,
  cashError: false,
  onCreateCash: vi.fn(noop),
  onUpdateCash: vi.fn(noop),
  onDeleteCash: vi.fn(noop),

  tags,
  tagsLoading: false,
  tagsError: false,
  onCreateTag: vi.fn(noop),
  onDeleteTag: vi.fn(noop),

  riskRules: {
    max_risk_per_trade: null,
    max_daily_loss: null,
    max_open_risk: null,
    default_account_risk_pct: null,
  },
  riskRulesLoading: false,
  riskRulesError: false,
  riskRulesSaving: false,
  onSaveRiskRules: vi.fn(noop),

  checklistItems: ["Check VIX"],
  checklistContent: "- [ ] Check VIX",
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
    expect(screen.getAllByText("$10,000.00").length).toBeGreaterThan(0);
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

  it("opens the AI tab from the URL hash", async () => {
    window.location.hash = "#ai";
    renderSettings({ ...baseProps });
    expect(await screen.findByRole("heading", { name: /screenshot scan/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /trade coach/i })).toBeInTheDocument();
  });

  it("renders the language select on the general tab", async () => {
    window.location.hash = "#general";
    renderSettings({ ...baseProps });
    expect(await screen.findByRole("combobox", { name: /language selector/i })).toBeInTheDocument();
  });

  it("shows all supported language options on the general tab", async () => {
    window.location.hash = "#general";
    renderSettings({ ...baseProps });
    const select = await screen.findByRole("combobox", { name: /language selector/i });
    expect(select).toHaveTextContent("English");
    const options = Array.from((select as HTMLSelectElement).options).map((o) => o.textContent);
    expect(options).toEqual(
      expect.arrayContaining(["English", "繁體中文（香港）", "日本語", "한국어"]),
    );
  });

  it("shows app config import/export actions on general tab", async () => {
    window.location.hash = "#general";
    renderSettings({ ...baseProps });
    expect(await screen.findByRole("button", { name: /export config/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import config/i })).toBeInTheDocument();
  });

  it("updates settings labels when language changes", async () => {
    const user = userEvent.setup();
    window.location.hash = "#general";
    renderSettings({ ...baseProps });
    const select = await screen.findByRole("combobox", { name: /language selector/i });
    await user.selectOptions(select, "ja");
    expect(await screen.findByRole("link", { name: /^一般$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "一般", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("言語")).toBeInTheDocument();
  });

  it("opens the API tab from the URL hash", async () => {
    window.location.hash = "#api";
    renderSettings({ ...baseProps });
    expect(await screen.findByRole("heading", { name: /api documentation/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /access tokens/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open docs/i })).toBeInTheDocument();
  });

  it("shows empty state for cash when no transactions", async () => {
    renderSettings({ ...baseProps, cashTransactions: [] });
    expect(await screen.findByText("No transactions yet")).toBeInTheDocument();
  });

  it("opens cash form from add transaction action", async () => {
    const user = userEvent.setup();
    renderSettings({ ...baseProps });
    await user.click(await screen.findByRole("button", { name: /add transaction/i }));
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /add rule/i })).toBeInTheDocument();
    expect(screen.getByText("No risk rules yet")).toBeInTheDocument();
  });

  it("lists configured risk rules and opens add modal", async () => {
    const user = userEvent.setup();
    renderSettings({
      ...baseProps,
      riskRules: {
        max_risk_per_trade: 100,
        max_daily_loss: null,
        max_open_risk: null,
        default_account_risk_pct: null,
      },
    });
    await user.click(screen.getByRole("link", { name: /^Rules$/i }));
    expect(screen.getByText("Max risk / trade")).toBeInTheDocument();
    expect(screen.getByText("$100")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /add rule/i }));
    expect(screen.getByRole("heading", { name: /add risk rule/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/rule type/i)).toBeInTheDocument();
  });

  it("shows rich checklist editor on rules tab", async () => {
    const user = userEvent.setup();
    renderSettings({ ...baseProps });
    await user.click(screen.getByRole("link", { name: /^Rules$/i }));
    expect(screen.getByText("Daily Checklist")).toBeInTheDocument();
    expect(screen.getByLabelText(/daily checklist and rules/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByText(/1 checklist item detected/i)).toBeInTheDocument();
  });

  it("points journal setups to Playbook instead of duplicating CRUD", async () => {
    const user = userEvent.setup();
    renderSettings({ ...baseProps });
    await user.click(screen.getByRole("link", { name: /^Journal$/i }));
    expect(screen.getByRole("heading", { name: "Playbook setups", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open playbook/i })).toHaveAttribute(
      "href",
      "/playbook",
    );
    expect(screen.queryByText("No setups yet")).not.toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: /^AI$/i })).toHaveAttribute("href", "#ai");
    expect(screen.getByRole("link", { name: /^About$/i })).toHaveAttribute("href", "#about");
  });

  it("opens the about tab from the URL hash", async () => {
    window.location.hash = "#about";
    renderSettings({ ...baseProps });
    expect(
      await screen.findByRole("heading", { name: "TraderMemos", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/open-source performance journal/i)).toBeInTheDocument();
    expect(screen.getByText("sinhong2011")).toBeInTheDocument();
    expect(screen.getByText("Backend API")).toBeInTheDocument();
    expect(screen.getByText("Updates")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check for updates/i })).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub repository" })).toHaveAttribute(
      "href",
      "https://github.com/sinhong2011/TraderMemos",
    );
    expect(screen.getAllByRole("link", { name: /github repository/i })).toHaveLength(2);
  });
});
