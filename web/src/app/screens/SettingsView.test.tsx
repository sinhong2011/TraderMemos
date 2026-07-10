import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Account, CashTransaction, Setup, Tag } from "../../lib/api/types";
import { SettingsView } from "./SettingsView";

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

	currentLocale: "en",
	onLocaleChange: vi.fn(),
};

describe("SettingsView", () => {
	it("renders the account name", () => {
		render(<SettingsView {...baseProps} />);
		expect(screen.getByText("Main")).toBeInTheDocument();
	});

	it("renders the language select", () => {
		render(<SettingsView {...baseProps} />);
		expect(
			screen.getByRole("combobox", { name: /language selector/i }),
		).toBeInTheDocument();
	});

	it("shows English as language option", () => {
		render(<SettingsView {...baseProps} />);
		expect(screen.getByText("English")).toBeInTheDocument();
	});

	it("shows empty state for cash when no transactions", () => {
		render(<SettingsView {...baseProps} />);
		expect(screen.getByText("No transactions yet")).toBeInTheDocument();
	});

	it("shows empty state for tags when no tags", () => {
		render(<SettingsView {...baseProps} />);
		expect(screen.getByText("No tags yet")).toBeInTheDocument();
	});

	it("renders risk rules section", () => {
		render(<SettingsView {...baseProps} />);
		expect(screen.getByText("Risk Rules")).toBeInTheDocument();
		expect(screen.getByLabelText(/max risk per trade/i)).toBeInTheDocument();
	});

	it("shows empty state for setups when none", () => {
		render(<SettingsView {...baseProps} />);
		expect(screen.getByText("No setups yet")).toBeInTheDocument();
	});

	it("renders accounts section panel header", () => {
		render(<SettingsView {...baseProps} />);
		expect(screen.getByText("Accounts")).toBeInTheDocument();
	});

	it("shows loading skeleton for accounts", () => {
		const { container } = render(
			<SettingsView {...baseProps} accountsLoading={true} accounts={[]} />,
		);
		const skeletons = container.querySelectorAll('[aria-hidden="true"]');
		expect(skeletons.length).toBeGreaterThan(0);
	});
});
