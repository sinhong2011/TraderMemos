import { useEffect } from "react";
import { setUnauthorizedHandler } from "../lib/api/client";
import { useAuth } from "../lib/auth";
import { useToastManager } from "./Toast";

/** Registers a 401 handler that signs out and surfaces a toast when session expires. */
export function UnauthorizedHandler() {
  const toast = useToastManager();
  const signOut = useAuth((s) => s.signOut);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      const wasAuthed = useAuth.getState().authed;
      signOut();
      if (wasAuthed) {
        toast.add({
          title: "Session expired",
          description: "Sign in again to continue.",
        });
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [toast, signOut]);

  return null;
}
