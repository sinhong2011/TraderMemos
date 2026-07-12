import { Copy, Plus, X } from "lucide-react";
import { cn } from "../../../lib/cn";

export function SessionRail({
	sessions,
	activeId,
	onSelect,
	onAdd,
	onDuplicate,
	onRemove,
}: {
	sessions: { id: string; name: string }[];
	activeId: string;
	onSelect: (id: string) => void;
	onAdd: () => void;
	onDuplicate: (id: string) => void;
	onRemove: (id: string) => void;
}) {
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="mr-1 text-[10px] font-medium uppercase tracking-widest text-text-dim">
				Positions
			</span>
			{sessions.map((s) => {
				const active = s.id === activeId;
				return (
					<div key={s.id} className="group relative flex items-center">
						<button
							type="button"
							onClick={() => onSelect(s.id)}
							className={cn(
								"rounded-control px-2.5 py-1 text-[11px] font-medium transition-colors",
								active
									? "bg-accent/15 text-accent"
									: "bg-bg-hover text-text-muted hover:text-text",
							)}
						>
							{s.name}
						</button>
						{active ? (
							<div className="ml-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
								<button
									type="button"
									aria-label="Duplicate"
									onClick={() => onDuplicate(s.id)}
									className="rounded p-0.5 text-text-dim hover:text-text"
								>
									<Copy size={11} />
								</button>
								{sessions.length > 1 ? (
									<button
										type="button"
										aria-label="Delete"
										onClick={() => onRemove(s.id)}
										className="rounded p-0.5 text-text-dim hover:text-loss"
									>
										<X size={11} />
									</button>
								) : null}
							</div>
						) : null}
					</div>
				);
			})}
			<button
				type="button"
				onClick={onAdd}
				className="flex items-center gap-1 rounded-control bg-bg-hover px-2 py-1 text-[11px] text-text-dim transition-colors hover:text-text"
			>
				<Plus size={11} />
				Add
			</button>
		</div>
	);
}
