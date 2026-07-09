import { Toast as BaseToast } from "@base-ui-components/react";
import type { ReactNode } from "react";
import { ToastItem } from "./Toast";

function ToastList() {
	const { toasts } = BaseToast.useToastManager();
	return (
		<>
			{toasts.map((toast) => (
				<ToastItem key={toast.id} toast={toast} />
			))}
		</>
	);
}

/**
 * Wrap the app shell in <Toaster> once; it provides the toast context and
 * renders the viewport. Use useToastManager() (re-exported from Toast.tsx)
 * inside any child to add toasts.
 */
export function Toaster({ children }: { children: ReactNode }) {
	return (
		<BaseToast.Provider>
			{children}
			<BaseToast.Viewport
				style={{
					position: "fixed",
					bottom: "24px",
					right: "24px",
					display: "flex",
					flexDirection: "column",
					gap: "8px",
					zIndex: 9999,
					margin: 0,
					padding: 0,
				}}
			>
				<ToastList />
			</BaseToast.Viewport>
		</BaseToast.Provider>
	);
}
