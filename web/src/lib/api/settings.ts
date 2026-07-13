import { apiFetch } from "./client";

export interface RiskRules {
	max_risk_per_trade: number | null;
	max_daily_loss: number | null;
	max_open_risk: number | null;
	default_account_risk_pct: number | null;
}

export interface ChecklistTemplate {
	items: string[];
}

export const settingsApi = {
	getRiskRules: () => apiFetch<RiskRules>("/settings/risk-rules"),
	putRiskRules: (body: RiskRules) =>
		apiFetch<RiskRules>("/settings/risk-rules", {
			method: "PUT",
			body: JSON.stringify(body),
		}),
	getChecklistTemplate: () =>
		apiFetch<ChecklistTemplate>("/settings/checklist-template"),
	putChecklistTemplate: (body: ChecklistTemplate) =>
		apiFetch<ChecklistTemplate>("/settings/checklist-template", {
			method: "PUT",
			body: JSON.stringify(body),
		}),
};
