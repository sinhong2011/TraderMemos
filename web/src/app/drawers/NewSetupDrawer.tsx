import { useForm } from "@tanstack/react-form";
import { Modal, ModalBanner } from "../../components/Modal";
import { SegmentedControl } from "../../components/SegmentedControl";
import { fieldError, SignalField } from "../../components/SignalField";
import { SignalInput, SignalTextarea } from "../../components/SignalInput";
import { useToastManager } from "../../components/Toast";
import { useCreateSetup } from "../../lib/hooks/useSetups";
import { useUI } from "../../lib/ui";

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

	const form = useForm({
		defaultValues: {
			name: "",
			thesis: "",
			symbol: "",
			direction: "long" as "long" | "short",
			target: "",
			stop: "",
			checklistText: "",
		},
		onSubmit: async ({ value }) => {
			const checklist = value.checklistText
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean);
			try {
				await createSetup.mutateAsync({
					name: value.name.trim(),
					description: value.thesis.trim(),
					thesis: value.thesis.trim(),
					symbol: value.symbol.trim().toUpperCase() || undefined,
					direction: value.direction,
					target_price: parseOptionalNum(value.target),
					stop_price: parseOptionalNum(value.stop),
					checklist,
				});
				toast.add({ title: "Setup created", description: value.name.trim() });
				close();
			} catch (e) {
				toast.add({
					title: "Could not create setup",
					description: e instanceof Error ? e.message : "Save failed",
				});
			}
		},
	});

	function reset() {
		form.reset();
	}

	function close() {
		reset();
		closeModal();
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
				type="submit"
				form="new-setup-form"
				disabled={createSetup.isPending}
				className="cursor-pointer rounded-control border-none bg-accent px-3.5 py-1.5 text-xs font-semibold text-bg disabled:opacity-50"
			>
				{createSetup.isPending ? "Saving…" : "Save setup"}
			</button>
		</div>
	);

	const submitError =
		createSetup.isError && createSetup.error instanceof Error
			? createSetup.error.message
			: createSetup.isError
				? "Save failed"
				: undefined;

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

			<form
				id="new-setup-form"
				className="flex flex-col gap-3"
				onSubmit={(e) => {
					e.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field
					name="name"
					validators={{
						onSubmit: ({ value }) =>
							!value.trim() ? "Name is required." : undefined,
					}}
				>
					{(field) => (
						<SignalField
							label="Name"
							htmlFor="ns-name"
							error={fieldError(field.state.meta.errors)}
						>
							<SignalInput
								id="ns-name"
								aria-label="Name"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="e.g. Gap and Go"
							/>
						</SignalField>
					)}
				</form.Field>

				<div className="grid grid-cols-2 gap-3">
					<form.Field name="symbol">
						{(field) => (
							<SignalField label="Symbol" htmlFor="ns-symbol">
								<SignalInput
									id="ns-symbol"
									aria-label="Symbol"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="AAPL"
								/>
							</SignalField>
						)}
					</form.Field>

					<form.Field name="direction">
						{(field) => (
							<SignalField label="Direction">
								<SegmentedControl
									ariaLabel="Direction"
									value={field.state.value}
									onChange={(v) => field.handleChange(v as "long" | "short")}
									options={[
										{ value: "long", label: "LONG" },
										{ value: "short", label: "SHORT" },
									]}
								/>
							</SignalField>
						)}
					</form.Field>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<form.Field name="target">
						{(field) => (
							<SignalField label="Target" htmlFor="ns-target">
								<SignalInput
									id="ns-target"
									aria-label="Target"
									inputMode="decimal"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</SignalField>
						)}
					</form.Field>

					<form.Field name="stop">
						{(field) => (
							<SignalField label="Stop" htmlFor="ns-stop">
								<SignalInput
									id="ns-stop"
									aria-label="Stop"
									inputMode="decimal"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</SignalField>
						)}
					</form.Field>
				</div>

				<form.Field name="thesis">
					{(field) => (
						<SignalField label="Thesis" htmlFor="ns-thesis">
							<SignalTextarea
								id="ns-thesis"
								aria-label="Thesis"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Why this setup? Entry criteria, invalidation…"
								rows={3}
							/>
						</SignalField>
					)}
				</form.Field>

				<form.Field name="checklistText">
					{(field) => (
						<SignalField
							label="Checklist (one item per line)"
							htmlFor="ns-check"
						>
							<SignalTextarea
								id="ns-check"
								aria-label="Checklist"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder={"Above VWAP\nRelative volume > 2"}
								rows={4}
							/>
						</SignalField>
					)}
				</form.Field>

				{submitError && (
					<p className="m-0 text-xs text-loss">{submitError}</p>
				)}
			</form>
		</Modal>
	);
}
