export function fmtMoney(v: number, currency: string, locale: string): string {
	return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
		v,
	);
}
export function fmtSignedMoney(
	v: number,
	currency: string,
	locale: string,
): string {
	const s = fmtMoney(Math.abs(v), currency, locale);
	return v < 0 ? `-${s}` : `+${s}`;
}
export function fmtPct(ratio: number, locale: string): string {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	}).format(ratio);
}

export function fmtDuration(secs: number | null | undefined): string {
	if (secs == null || secs <= 0) return "-";
	if (secs < 3600) return `${Math.max(1, Math.round(secs / 60))}m`;
	if (secs < 86400) return `${Math.round(secs / 3600)}h`;
	return `${Math.round(secs / 86400)}d`;
}

export function fmtDateShort(iso: string | null): string {
	if (!iso) return "-";
	const d = new Date(iso);
	return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export function fmtRecord(wins: number, losses: number): string {
	const parts: string[] = [];
	if (wins > 0) parts.push(`${wins}W`);
	if (losses > 0) parts.push(`${losses}L`);
	return parts.length > 0 ? parts.join("") : "-";
}
