const STORAGE_KEY = "tradermemos-trade-templates";

export interface ExecutionTemplateRow {
	side: "buy" | "sell";
	quantity: string;
	price: string;
	fees: string;
}

export interface TradeTemplate {
	id: string;
	name: string;
	market: string;
	symbol: string;
	side: "long" | "short";
	target: string;
	stop: string;
	rows: ExecutionTemplateRow[];
	setupId: string;
	notes: string;
	emotionalState: string;
	confidence: number;
	tradeQuality: number;
	tagIds: string[];
	mistakeTagIds: string[];
	created_at: string;
}

function loadAll(): TradeTemplate[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		return JSON.parse(raw) as TradeTemplate[];
	} catch {
		return [];
	}
}

function saveAll(templates: TradeTemplate[]) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function listTradeTemplates(): TradeTemplate[] {
	return loadAll().sort((a, b) => a.name.localeCompare(b.name));
}

export function saveTradeTemplate(
	template: Omit<TradeTemplate, "id" | "created_at">,
): TradeTemplate {
	const entry: TradeTemplate = {
		...template,
		id: crypto.randomUUID(),
		created_at: new Date().toISOString(),
	};
	saveAll([entry, ...loadAll()]);
	return entry;
}

export function deleteTradeTemplate(id: string) {
	saveAll(loadAll().filter((t) => t.id !== id));
}
