import { AlertTriangle, CircleAlert } from "lucide-react";
import type { Warning } from "@/lib/r-calculator/calc";
import { msg } from "@/lib/r-calculator/messages";
import { Alert, AlertTitle } from "@/components/ui/alert";

export function WarningBanner({ warns }: { warns: Warning[] }) {
  if (warns.length === 0) return null;

  const serious = warns.filter((w) => w.tone !== "ok");
  const notes = warns.filter((w) => w.tone === "ok");

  return (
    // Each `Alert` carries its own `role="alert"`; the notes get a polite region below.
    <div className="flex flex-col gap-2">
      {serious.map((w) => {
        const danger = w.tone === "danger";
        const Icon = danger ? CircleAlert : AlertTriangle;
        return (
          <Alert key={w.key} variant={danger ? "error" : "warning"}>
            <Icon aria-hidden />
            <AlertTitle className="font-normal">{msg(w.key)}</AlertTitle>
          </Alert>
        );
      })}
      {notes.length > 0 ? (
        <div className="flex flex-col gap-1" role="status" aria-live="polite">
          {notes.map((w) => (
            <p key={w.key} className="m-0 text-xs text-muted-foreground">
              {msg(w.key)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
