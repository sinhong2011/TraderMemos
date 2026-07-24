import type { OcrSettings } from "../lib/api/settings";
import { getOcrVisionSetupIssues, OCR_VISION_SETUP_STEPS } from "../lib/ocrVisionReady";
import { Modal } from "./Modal";
import { Button } from "./ui/button";

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
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onOpenSettings();
            }}
          >
            Open settings
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Screenshot scan uses an LLM vision API to read broker fills. Configure it once in Settings →
        AI, then return here to prefill trades.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {issues.map((issue) => {
          const step = OCR_VISION_SETUP_STEPS[issue];
          return (
            <li key={issue} className="rounded-md bg-muted px-3 py-2.5 text-[12px] leading-relaxed">
              <div className="font-medium text-foreground">{step.label}</div>
              <div className="mt-0.5 text-muted-foreground">{step.detail}</div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
