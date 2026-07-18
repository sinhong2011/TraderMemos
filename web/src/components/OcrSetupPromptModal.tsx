import { Settings } from "lucide-react";
import type { OcrSettings } from "../lib/api/settings";
import { getOcrVisionSetupIssues, OCR_VISION_SETUP_STEPS } from "../lib/ocrVisionReady";
import { cn } from "../lib/cn";
import { Modal } from "./Modal";

const btnGhost =
  "inline-flex h-10 cursor-pointer items-center justify-center rounded-control border-none bg-bg-input px-3.5 text-[12px] font-medium text-text-muted transition-colors hover:bg-bg-input-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary =
  "inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-control border-none bg-accent px-5 text-[13px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export function OcrSetupPromptModal({
  open,
  onOpenChange,
  settings,
  onOpenSettings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: OcrSettings | undefined;
  onOpenSettings: () => void;
}) {
  const issues = getOcrVisionSetupIssues(settings);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Set up screenshot scan"
      className="max-w-md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={() => onOpenChange(false)}>
            Not now
          </button>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => {
              onOpenChange(false);
              onOpenSettings();
            }}
          >
            <Settings size={14} strokeWidth={1.75} aria-hidden />
            Open settings
          </button>
        </div>
      }
    >
      <p className="text-[13px] leading-relaxed text-text-muted">
        Screenshot scan uses an LLM vision API to read broker fills. Configure it once in Settings →
        General, then return here to prefill trades.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {issues.map((issue) => {
          const step = OCR_VISION_SETUP_STEPS[issue];
          return (
            <li
              key={issue}
              className="rounded-control bg-bg-input px-3 py-2.5 text-[12px] leading-relaxed"
            >
              <div className="font-medium text-text">{step.label}</div>
              <div className="mt-0.5 text-text-muted">{step.detail}</div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

/** Muted scan trigger styling when vision is not configured yet. */
export function ocrScanButtonClass(ready: boolean, pending: boolean) {
  return cn(
    "inline-flex h-10 cursor-pointer items-center justify-center rounded-control border-none bg-bg-input px-3.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 gap-1.5",
    ready
      ? "text-text-muted hover:bg-bg-input-hover hover:text-text"
      : "text-text-dim hover:bg-bg-input-hover hover:text-text-muted",
    pending && "opacity-70",
  );
}
