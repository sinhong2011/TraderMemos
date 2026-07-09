import { useState } from "react";
import { Drawer, DrawerBanner } from "../../components/Drawer";
import { useToastManager } from "../../components/Toast";
import { useCreateSetup } from "../../lib/hooks/useSetups";
import { useUI } from "../../lib/ui";

const inputStyle: React.CSSProperties = {
	background: "var(--color-surface-raised)",
	color: "var(--color-text)",
	border: "1px solid var(--color-border)",
	borderRadius: "var(--radius-control)",
	padding: "7px 10px",
	fontSize: 13,
	fontFamily: "var(--font-ui)",
	outline: "none",
	width: "100%",
};

const labelStyle: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 600,
	textTransform: "uppercase",
	letterSpacing: "0.04em",
	color: "var(--color-text-muted)",
};

export function NewSetupDrawer() {
	const open = useUI((s) => s.drawer === "new-setup");
	const closeDrawer = useUI((s) => s.closeDrawer);
	const toast = useToastManager();
	const createSetup = useCreateSetup();

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState("");

	function close() {
		setName("");
		setDescription("");
		setError("");
		closeDrawer();
	}

	async function save() {
		setError("");
		if (!name.trim()) {
			setError("Name is required.");
			return;
		}
		try {
			await createSetup.mutateAsync({
				name: name.trim(),
				description: description.trim() || undefined,
			});
			toast.add({ title: "Setup created", description: name.trim() });
			close();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Save failed");
		}
	}

	const footer = (
		<>
			<button
				type="button"
				onClick={close}
				style={{
					background: "var(--color-surface-raised)",
					color: "var(--color-text)",
					border: "1px solid var(--color-border)",
					borderRadius: "var(--radius-control)",
					padding: "7px 14px",
					fontSize: 13,
					cursor: "pointer",
				}}
			>
				Cancel
			</button>
			<button
				type="button"
				onClick={save}
				disabled={createSetup.isPending}
				style={{
					background: "var(--color-accent)",
					color: "#0e1218",
					border: "none",
					borderRadius: "var(--radius-control)",
					padding: "7px 16px",
					fontSize: 13,
					fontWeight: 600,
					cursor: createSetup.isPending ? "default" : "pointer",
					opacity: createSetup.isPending ? 0.6 : 1,
				}}
			>
				Save
			</button>
		</>
	);

	return (
		<Drawer
			open={open}
			onOpenChange={(o) => {
				if (!o) close();
			}}
			title="New Setup"
			footer={footer}
		>
			<DrawerBanner>
				Define a playbook setup — a repeatable pattern you trade. Tag trades
				with it later to compare performance per setup.
			</DrawerBanner>

			<div className="flex flex-col gap-1">
				<label htmlFor="ns-name" style={labelStyle}>
					Name
				</label>
				<input
					id="ns-name"
					aria-label="Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="e.g. Gap and Go"
					style={inputStyle}
				/>
			</div>

			<div className="flex flex-col gap-1">
				<label htmlFor="ns-desc" style={labelStyle}>
					Description / Notes
				</label>
				<textarea
					id="ns-desc"
					aria-label="Description / Notes"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="What defines this setup? Entry criteria, invalidation, targets…"
					rows={6}
					style={{ ...inputStyle, resize: "vertical" }}
				/>
			</div>

			{error && (
				<p className="text-xs" style={{ color: "var(--color-neg)" }}>
					{error}
				</p>
			)}
		</Drawer>
	);
}
