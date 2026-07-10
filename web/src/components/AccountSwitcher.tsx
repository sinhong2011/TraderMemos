import { Select } from "@base-ui-components/react";
import { Check, ChevronDown } from "lucide-react";
import { useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";

export function AccountSwitcher() {
	const { data: accounts, isLoading } = useAccounts();
	const { accountId, setAccount } = useFilters();

	const items = accounts ?? [];
	const selectedLabel =
		items.find((a) => a.id === accountId)?.name ?? "All accounts";

	if (isLoading) {
		return (
			<div
				style={{
					background: "var(--color-surface-hover)",
					color: "var(--color-text-muted)",
					border: "1px solid var(--color-border)",
					borderRadius: "var(--radius-control)",
					padding: "6px 12px",
					fontSize: "12px",
					minWidth: "140px",
				}}
			>
				Loading...
			</div>
		);
	}

	return (
		<Select.Root
			value={accountId ?? ""}
			onValueChange={(val: string | null) =>
				setAccount(val == null || val === "" ? undefined : val)
			}
		>
			<Select.Trigger
				style={{
					display: "flex",
					alignItems: "center",
					gap: "8px",
					background: "var(--color-surface-raised)",
					color: "var(--color-text)",
					border: "1px solid var(--color-border)",
					borderRadius: "999px",
					padding: "8px 14px",
					cursor: "pointer",
					width: "100%",
					fontFamily: "var(--font-ui)",
					fontSize: "13px",
					transition: "border-color var(--duration-fast)",
				}}
			>
				<span
					aria-hidden
					style={{
						width: 8,
						height: 8,
						borderRadius: 999,
						background: "var(--color-pos)",
						flexShrink: 0,
					}}
				/>
				<Select.Value>{() => selectedLabel}</Select.Value>
				<ChevronDown
					size={12}
					strokeWidth={1.5}
					style={{ color: "var(--color-text-muted)", marginLeft: "auto" }}
				/>
			</Select.Trigger>

			<Select.Portal>
				<Select.Positioner side="bottom" align="start" sideOffset={4}>
					<Select.Popup
						style={{
							background: "var(--color-surface-panel)",
							border: "1px solid var(--color-border)",
							borderRadius: "var(--radius-panel)",
							minWidth: "160px",
							padding: "4px",
							boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
							zIndex: 100,
						}}
					>
						<Select.List>
							<Select.Item
								value=""
								style={{
									display: "flex",
									alignItems: "center",
									gap: "8px",
									padding: "6px 8px",
									borderRadius: "var(--radius-control)",
									fontSize: "12px",
									cursor: "pointer",
									color: "var(--color-text)",
									fontFamily: "var(--font-ui)",
								}}
							>
								<Select.ItemIndicator>
									<Check
										size={12}
										strokeWidth={1.5}
										style={{ color: "var(--color-accent)" }}
									/>
								</Select.ItemIndicator>
								<Select.ItemText>All accounts</Select.ItemText>
							</Select.Item>

							{items.map((account) => (
								<Select.Item
									key={account.id}
									value={account.id}
									style={{
										display: "flex",
										alignItems: "center",
										gap: "8px",
										padding: "6px 8px",
										borderRadius: "var(--radius-control)",
										fontSize: "12px",
										cursor: "pointer",
										color: "var(--color-text)",
										fontFamily: "var(--font-ui)",
									}}
								>
									<Select.ItemIndicator>
										<Check
											size={12}
											strokeWidth={1.5}
											style={{ color: "var(--color-accent)" }}
										/>
									</Select.ItemIndicator>
									<Select.ItemText>{account.name}</Select.ItemText>
								</Select.Item>
							))}
						</Select.List>
					</Select.Popup>
				</Select.Positioner>
			</Select.Portal>
		</Select.Root>
	);
}
