import { Select } from "@base-ui-components/react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

export type SignalSelectOption = {
	value: string;
	label: string;
	disabled?: boolean;
};

export function SignalSelect({
	value,
	onValueChange,
	options,
	placeholder = "Select…",
	ariaLabel,
	id,
	disabled,
	className,
	triggerClassName,
}: {
	value: string;
	onValueChange: (value: string) => void;
	options: readonly SignalSelectOption[];
	placeholder?: string;
	ariaLabel?: string;
	id?: string;
	disabled?: boolean;
	className?: string;
	triggerClassName?: string;
}) {
	const labelFor = (current: string | null) => {
		const option = options.find((o) => o.value === (current ?? value));
		return option?.label;
	};

	return (
		<div className={cn("min-w-0", className)}>
			<Select.Root
				value={value}
				onValueChange={(val: string | null) => onValueChange(val ?? "")}
				disabled={disabled}
				modal={false}
			>
				<Select.Trigger
					id={id}
					aria-label={ariaLabel}
					className={cn(
						"flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-control border border-border bg-bg-inset px-2.5",
						"text-left text-[12px] text-text outline-none transition-[border-color,background-color,box-shadow] duration-150",
						"hover:border-border-strong focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--color-accent-bg)]",
						"data-[disabled]:cursor-default data-[disabled]:opacity-55",
						triggerClassName,
					)}
				>
					<span className="min-w-0 flex-1 truncate">
						<Select.Value>
							{(current) =>
								labelFor(current) ? (
									labelFor(current)
								) : (
									<span className="text-text-dim">{placeholder}</span>
								)
							}
						</Select.Value>
					</span>
					<ChevronDown
						size={12}
						strokeWidth={1.5}
						className="shrink-0 text-text-dim"
						aria-hidden
					/>
				</Select.Trigger>

				<Select.Portal>
					<Select.Positioner
						side="bottom"
						align="start"
						sideOffset={4}
						positionMethod="fixed"
						alignItemWithTrigger={false}
						className="z-[400]"
					>
						<Select.Popup
							className={cn(
								"max-h-64 min-w-[var(--anchor-width)] overflow-auto rounded-overlay border border-border-strong bg-bg-panel p-1",
								"shadow-[0_12px_32px_rgba(0,0,0,0.45)] outline-none",
								"origin-[var(--transform-origin)] transition-[transform,opacity] duration-150 ease-out",
								"data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
								"data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
								"motion-reduce:transition-none",
							)}
						>
							<Select.List>
								{options.map((option) => (
									<Select.Item
										key={option.value}
										value={option.value}
										disabled={option.disabled}
										className={cn(
											"flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-[12px] text-text outline-none",
											"data-[highlighted]:bg-bg-hover data-[selected]:text-accent",
											"data-[disabled]:cursor-default data-[disabled]:opacity-40",
										)}
									>
										<Select.ItemIndicator className="flex w-3 shrink-0 justify-center">
											<Check
												size={12}
												strokeWidth={1.5}
												className="text-accent"
											/>
										</Select.ItemIndicator>
										<Select.ItemText className="min-w-0 flex-1 truncate">
											{option.label}
										</Select.ItemText>
									</Select.Item>
								))}
							</Select.List>
						</Select.Popup>
					</Select.Positioner>
				</Select.Portal>
			</Select.Root>
		</div>
	);
}
