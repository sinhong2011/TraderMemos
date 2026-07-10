import { useEffect, useState } from "react";
import { Modal } from "../../components/Modal";
import { useToastManager } from "../../components/Toast";
import { notesApi } from "../../lib/api/notes";
import { settingsApi } from "../../lib/api/settings";
import { useUI } from "../../lib/ui";

function nowLocalDate(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const inputClass =
	"w-full rounded-control border border-border bg-bg-inset px-2.5 py-2 text-xs text-text outline-none placeholder:text-text-dim";

const labelClass =
	"mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-widest text-text-dim";

export function NewNoteDrawer() {
	const open = useUI((s) => s.modal === "new-note");
	const closeModal = useUI((s) => s.closeModal);
	const toast = useToastManager();

	const [occurredAt, setOccurredAt] = useState(nowLocalDate());
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [checklist, setChecklist] = useState<string[]>([]);
	const [checked, setChecked] = useState<Record<string, boolean>>({});
	const [saving, setSaving] = useState(false);

	function reset() {
		setOccurredAt(nowLocalDate());
		setTitle("");
		setBody("");
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

	async function handleSave() {
		const trimmed = body.trim();
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
				occurred_at: occurredAt,
				title: title.trim() || "Untitled note",
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
	}

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
						onClick={() => void handleSave()}
						disabled={!body.trim() || saving}
						className="cursor-pointer rounded-control bg-accent px-3 py-1.5 text-xs font-medium text-bg disabled:cursor-not-allowed disabled:opacity-40"
					>
						{saving ? "Saving…" : "Save note"}
					</button>
				</div>
			}
		>
			<div className="flex flex-col gap-4">
				<div>
					<label className={labelClass} htmlFor="note-date">
						Date
					</label>
					<input
						id="note-date"
						type="date"
						value={occurredAt}
						onChange={(e) => setOccurredAt(e.target.value)}
						className={inputClass}
					/>
				</div>
				<div>
					<label className={labelClass} htmlFor="note-title">
						Title
					</label>
					<input
						id="note-title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Session recap, market read, discipline check…"
						className={inputClass}
					/>
				</div>
				{checklist.length > 0 && (
					<div>
						<span className={labelClass}>Daily checklist</span>
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
				<div>
					<label className={labelClass} htmlFor="note-body">
						Note
					</label>
					<textarea
						id="note-body"
						value={body}
						onChange={(e) => setBody(e.target.value)}
						placeholder="What happened today? What will you do differently?"
						rows={10}
						className={`${inputClass} resize-y`}
					/>
				</div>
			</div>
		</Modal>
	);
}
