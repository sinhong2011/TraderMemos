import { useState } from "react";
import { Modal, ModalBanner } from "../../components/Modal";
import { SegmentedControl } from "../../components/SegmentedControl";
import { useToastManager } from "../../components/Toast";
import { useCreateSetup } from "../../lib/hooks/useSetups";
import { useUI } from "../../lib/ui";

const inputClass =
	"w-full rounded-control border border-border bg-bg-inset px-2.5 py-2 text-xs text-text outline-none placeholder:text-text-dim";
const labelClass =
	"mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-text-dim";

function parseOptionalNum(v: string): number | null {
	const t = v.trim();
	if (!t) return null;
	const n = Number(t);
	return Number.isFinite(n) ? n : null;
}

export function NewSetupDrawer() {
	const open = useUI((s) => s.modal === "new-setup");
	const closeModal = useUI((s) => s.closeModal);
	const toast = useToastManager();
	const createSetup = useCreateSetup();

	const [name, setName] = useState("");
	const [thesis, setThesis] = useState("");
	const [symbol, setSymbol] = useState("");
	const [direction, setDirection] = useState<"long" | "short">("long");
	const [target, setTarget] = useState("");
	const [stop, setStop] = useState("");
	const [checklistText, setChecklistText] = useState("");
	const [error, setError] = useState("");

	function reset() {
		setName("");
		setThesis("");
		setSymbol("");
		setDirection("long");
		setTarget("");
		setStop("");
		setChecklistText("");
		setError("");
	}

	function close() {
		reset();
		closeModal();
	}

	async function save() {
		setError("");
		if (!name.trim()) {
			setError("Name is required.");
			return;
		}
		const checklist = checklistText
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
		try {
			await createSetup.mutateAsync({
				name: name.trim(),
				description: thesis.trim(),
				thesis: thesis.trim(),
				symbol: symbol.trim().toUpperCase() || undefined,
				direction,
				target_price: parseOptionalNum(target),
				stop_price: parseOptionalNum(stop),
				checklist,
			});
			toast.add({ title: "Setup created", description: name.trim() });
			close();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Save failed");
		}
	}

	const footer = (
		<div className="flex w-full justify-end gap-2">
			<button
				type="button"
				onClick={close}
				disabled={createSetup.isPending}
				className="cursor-pointer rounded-control border border-border bg-bg-elevated px-3 py-1.5 text-[11px] font-medium text-text-muted hover:bg-bg-hover hover:text-text disabled:opacity-50"
			>
				Cancel
			</button>
			<button
				type="button"
				onClick={() => void save()}
				disabled={createSetup.isPending}
				className="cursor-pointer rounded-control border-none bg-accent px-3.5 py-1.5 text-xs font-semibold text-bg disabled:opacity-50"
			>
				{createSetup.isPending ? "Saving…" : "Save setup"}
			</button>
		</div>
	);

	return (
		<Modal
			open={open}
			onOpenChange={(o) => {
				if (!o && !createSetup.isPending) close();
			}}
			title="New Setup"
			footer={footer}
		>
			<ModalBanner>
				Define a planned playbook setup — thesis, levels, and checklist. Convert
				it to a trade when you take the shot.
			</ModalBanner>

			<div className="flex flex-col gap-1">
				<label htmlFor="ns-name" className={labelClass}>
					Name
				</label>
				<input
					id="ns-name"
					aria-label="Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="e.g. Gap and Go"
					className={inputClass}
				/>
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-1">
					<label htmlFor="ns-symbol" className={labelClass}>
						Symbol
					</label>
					<input
						id="ns-symbol"
						aria-label="Symbol"
						value={symbol}
						onChange={(e) => setSymbol(e.target.value)}
						placeholder="AAPL"
						className={inputClass}
					/>
				</div>
				<div className="flex flex-col gap-1">
					<span className={labelClass}>Direction</span>
					<SegmentedControl
						ariaLabel="Direction"
						value={direction}
						onChange={(v) => setDirection(v as "long" | "short")}
						options={[
							{ value: "long", label: "LONG" },
							{ value: "short", label: "SHORT" },
						]}
					/>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-1">
					<label htmlFor="ns-target" className={labelClass}>
						Target
					</label>
					<input
						id="ns-target"
						aria-label="Target"
						inputMode="decimal"
						value={target}
						onChange={(e) => setTarget(e.target.value)}
						className={inputClass}
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label htmlFor="ns-stop" className={labelClass}>
						Stop
					</label>
					<input
						id="ns-stop"
						aria-label="Stop"
						inputMode="decimal"
						value={stop}
						onChange={(e) => setStop(e.target.value)}
						className={inputClass}
					/>
				</div>
			</div>

			<div className="flex flex-col gap-1">
				<label htmlFor="ns-thesis" className={labelClass}>
					Thesis
				</label>
				<textarea
					id="ns-thesis"
					aria-label="Thesis"
					value={thesis}
					onChange={(e) => setThesis(e.target.value)}
					placeholder="Why this setup? Entry criteria, invalidation…"
					rows={3}
					className={`${inputClass} resize-y`}
				/>
			</div>

			<div className="flex flex-col gap-1">
				<label htmlFor="ns-check" className={labelClass}>
					Checklist (one item per line)
				</label>
				<textarea
					id="ns-check"
					aria-label="Checklist"
					value={checklistText}
					onChange={(e) => setChecklistText(e.target.value)}
					placeholder={"Above VWAP\nRelative volume > 2"}
					rows={4}
					className={`${inputClass} resize-y font-mono`}
				/>
			</div>

			{error && <p className="m-0 text-xs text-loss">{error}</p>}
		</Modal>
	);
}
