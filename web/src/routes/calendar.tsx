import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarView } from "../app/screens/CalendarView";
import { useFilterParams, useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useDailyPnl } from "../lib/hooks/useAnalytics";
import { useTrades } from "../lib/hooks/useTrades";

export const Route = createFileRoute("/calendar")({
	component: CalendarPage,
});

function CalendarPage() {
	const filters = useFilterParams();
	const accountId = useFilters((s) => s.accountId);
	const accountsQ = useAccounts();

	const now = new Date();
	const [year, setYear] = useState(now.getFullYear());
	const [month, setMonth] = useState(now.getMonth() + 1); // 1-based

	const [selectedDay, setSelectedDay] = useState<string | null>(null);

	const dailyQ = useDailyPnl(filters);

	// Derive day-range filters only when a day is selected
	const dayStart = selectedDay ? `${selectedDay}T00:00:00Z` : undefined;
	const dayEnd = selectedDay ? `${selectedDay}T23:59:59Z` : undefined;

	const dayFilters = selectedDay
		? { ...filters, from: dayStart, to: dayEnd }
		: {
				account_id: undefined,
				from: undefined,
				to: undefined,
				symbol: undefined,
			};

	const dayTradesQ = useTrades(dayFilters);

	// Currency resolution
	const accounts = accountsQ.data ?? [];
	const account = accounts.find((a) => a.id === accountId);
	const currency = account?.base_currency ?? "USD";

	function prevMonth() {
		if (month === 1) {
			setMonth(12);
			setYear((y) => y - 1);
		} else {
			setMonth((m) => m - 1);
		}
		setSelectedDay(null);
	}

	function nextMonth() {
		if (month === 12) {
			setMonth(1);
			setYear((y) => y + 1);
		} else {
			setMonth((m) => m + 1);
		}
		setSelectedDay(null);
	}

	return (
		<CalendarView
			dailyPnl={dailyQ.data ?? {}}
			dailyLoading={dailyQ.isLoading}
			dailyError={dailyQ.isError}
			year={year}
			month={month}
			onPrevMonth={prevMonth}
			onNextMonth={nextMonth}
			selectedDay={selectedDay}
			onSelectDay={setSelectedDay}
			dayTrades={selectedDay ? (dayTradesQ.data ?? []) : []}
			dayTradesLoading={selectedDay ? dayTradesQ.isLoading : false}
			dayTradesError={selectedDay ? dayTradesQ.isError : false}
			filters={filters}
			currency={currency}
		/>
	);
}
