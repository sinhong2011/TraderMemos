import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";
import { Modal } from "../../components/Modal";
import { SignalDatePicker } from "../../components/SignalDatePicker";
import { fieldError, SignalField } from "../../components/SignalField";
import { SignalInput, SignalTextarea } from "../../components/SignalInput";
import { useToastManager } from "../../components/Toast";
import { notesApi } from "../../lib/api/notes";
import { settingsApi } from "../../lib/api/settings";
import { useUI } from "../../lib/ui";
import { signalLabelClass } from "../../components/signal-field-styles";

function nowLocalDate(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function NewNoteDrawer() {
	const open = useUI((s) => s.modal === "new-note");
	const closeModal = useUI((s) => s.closeModal);
	const toast = useToastManager();

	const [checklist, setChecklist] = useState<string[]>([]);
	const [checked, setChecked] = useState<Record<string, boolean>>({});
	const [saving, setSaving] = useState(false);

	const form = useForm({
		defaultValues: {
			occurredAt: nowLocalDate(),
			title: "",
			body: "",
		},
		onSubmit: async ({ value }) => {
			const trimmed = value.body.trim();
			if (!trimmed) return;
			setSaving(true);
			try {
				const checklistBlock =
					checklist.length > 0
						? `\n\nChecklist:\n${checklist
								.map((item) => `- [${checked[item] ? "x" : " "}] ${item}`)
								.join("\n")}`
						: "";
				const note = await notesApi.create({
					occurred_at: value.occurredAt,
					title: value.title.trim() || "Untitled note",
					body: `${trimmed}${checklistBlock}`,
				});
				toast.add({ title: "Note saved", description: note.title });
				close();
			} catch (e) {
				toast.add({
					title: "Could not save note",
					description: e instanceof Error ? e.message : "Try again",
				});
			} finally {
				setSaving(false);
			}
		},
	});

	function reset() {
		form.reset();
		setChecked({});
	}

	function close() {
		reset();
		closeModal();
	}

	useEffect(() => {
		if (!open) return;
		reset();
		void settingsApi.getChecklistTemplate().then((t) => {
			setChecklist(t.items ?? []);
		});
	}, [open]);

	return (
		<Modal
			open={open}
			onOpenChange={(v) => !v && !saving && close()}
			title="New Note"
			footer={
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={close}
						disabled={saving}
						className="cursor-pointer rounded-control border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-bg-hover"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={() => void form.handleSubmit()}
						disabled={!form.state.values.body.trim() || saving}
						className="cursor-pointer rounded-control bg-accent px-3 py-1.5 text-xs font-medium text-bg disabled:cursor-not-allowed disabled:opacity-40"
					>
						{saving ? "Saving…" : "Save note"}
					</button>
				</div>
			}
		>
			<form
				className="flex flex-col gap-4"
				onSubmit={(e) => {
					e.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field name="occurredAt">
					{(field) => (
						<SignalField label="Date" htmlFor="note-date">
							<SignalDatePicker
								id="note-date"
								aria-label="Date"
								value={field.state.value}
								onChange={field.handleChange}
								onBlur={field.handleBlur}
							/>
						</SignalField>
					)}
				</form.Field>

				<form.Field name="title">
					{(field) => (
						<SignalField label="Title" htmlFor="note-title">
							<SignalInput
								id="note-title"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Session recap, market read, discipline check…"
							/>
						</SignalField>
					)}
				</form.Field>

				{checklist.length > 0 && (
					<div>
						<span className={signalLabelClass}>Daily checklist</span>
						<div className="flex flex-col gap-1.5 rounded-panel border border-border bg-bg-inset px-3 py-2">
							{checklist.map((item) => (
								<label
									key={item}
									className="flex cursor-pointer items-center gap-2 text-xs text-text"
								>
									<input
										type="checkbox"
										checked={Boolean(checked[item])}
										onChange={() =>
											setChecked((c) => ({ ...c, [item]: !c[item] }))
										}
										style={{ accentColor: "var(--color-accent)" }}
									/>
									{item}
								</label>
							))}
						</div>
					</div>
				)}

				<form.Field
					name="body"
					validators={{
						onSubmit: ({ value }) =>
							!value.trim() ? "Note body is required." : undefined,
					}}
				>
					{(field) => (
						<SignalField
							label="Note"
							htmlFor="note-body"
							error={fieldError(field.state.meta.errors)}
						>
							<SignalTextarea
								id="note-body"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="What happened today? What will you do differently?"
								rows={10}
							/>
						</SignalField>
					)}
				</form.Field>
			</form>
		</Modal>
	);
}
