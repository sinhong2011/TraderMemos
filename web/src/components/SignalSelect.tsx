import { Select } from "@base-ui-components/react";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";
import {
	signalOverlayPopupClass,
	signalSelectItemClass,
	signalSelectListClass,
} from "./signal-overlay-styles";

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
	const [open, setOpen] = useState(false);

	const labelFor = (current: string | null) => {
		const option = options.find((o) => o.value === (current ?? value));
		return option?.label;
	};

	return (
		<div className={cn("min-w-0", className)}>
			<Select.Root
				value={value}
				onValueChange={(val: string | null) => onValueChange(val ?? "")}
				open={open}
				onOpenChange={setOpen}
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
						open && "border-accent bg-bg-elevated shadow-[0_0_0_3px_var(--color-accent-bg)]",
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
						className={cn(
							"shrink-0 text-text-dim transition-transform duration-[220ms] ease-out",
							open && "rotate-180 text-accent",
							"motion-reduce:transition-none",
						)}
						aria-hidden
					/>
				</Select.Trigger>

				<Select.Portal>
					<Select.Positioner
						side="bottom"
						align="start"
						sideOffset={6}
						positionMethod="fixed"
						alignItemWithTrigger={false}
						className="z-[400]"
					>
						<Select.Popup
							className={cn(
								signalOverlayPopupClass,
								"max-h-64 min-w-[max(var(--anchor-width),9rem)] overflow-auto",
							)}
						>
							<Select.List className={signalSelectListClass}>
								{options.map((option) => (
									<Select.Item
										key={option.value}
										value={option.value}
										disabled={option.disabled}
										className={signalSelectItemClass}
									>
										<Select.ItemIndicator className="flex w-3.5 shrink-0 justify-center">
											<Check
												size={13}
												strokeWidth={2}
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
