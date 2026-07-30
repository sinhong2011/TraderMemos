import { useForm } from "@tanstack/react-form";
import { X } from "lucide-react";
import { useEffect } from "react";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/Drawer";
import { SegmentedControl } from "@/components/SegmentedControl";
import { fieldError, Field } from "@/components/Field";
import { AmountInput } from "@/components/AmountInput";
import { FormInput, FormTextarea } from "@/components/FormInput";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { parseAmountToNumber } from "@/lib/amountInput";
import { useCreateSetup, useUpdateSetup } from "@/lib/hooks/useSetups";
import { useUI } from "@/lib/ui";

/** Checklist textarea → one trimmed item per non-empty line. */
function parseChecklist(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

const EMPTY_VALUES = {
  name: "",
  thesis: "",
  symbol: "",
  direction: "long" as "long" | "short",
  target: "",
  stop: "",
  checklistText: "",
};

export function NewSetupDrawer() {
  const open = useUI((s) => s.modal === "new-setup");
  const setupDraft = useUI((s) => s.setupDraft);
  const closeModal = useUI((s) => s.closeModal);
  const toast = useToastManager();
  const createSetup = useCreateSetup();
  const updateSetup = useUpdateSetup();
  const editingId = setupDraft?.id ?? null;
  const isEdit = editingId != null;

  const form = useForm({
    formId: "new-setup",
    defaultValues: EMPTY_VALUES,
    onSubmit: async ({ value }) => {
      const checklist = parseChecklist(value.checklistText);
      const body = {
        name: value.name.trim(),
        description: value.thesis.trim(),
        thesis: value.thesis.trim(),
        symbol: value.symbol.trim().toUpperCase() || undefined,
        direction: value.direction,
        target_price: parseAmountToNumber(value.target),
        stop_price: parseAmountToNumber(value.stop),
        checklist,
      };
      try {
        if (editingId) {
          await updateSetup.mutateAsync({ id: editingId, body });
          toast.add({ title: "Setup updated", description: body.name });
        } else {
          await createSetup.mutateAsync(body);
          toast.add({ title: "Setup created", description: body.name });
        }
        close();
      } catch (e) {
        toast.add({
          title: editingId ? "Could not update setup" : "Could not create setup",
          description: e instanceof Error ? e.message : "Save failed",
        });
      }
    },
  });

  useEffect(() => {
    if (!open) return;
    if (setupDraft) {
      form.reset({
        name: setupDraft.name,
        thesis: setupDraft.thesis,
        symbol: setupDraft.symbol,
        direction: setupDraft.direction,
        target: setupDraft.target,
        stop: setupDraft.stop,
        checklistText: setupDraft.checklistText,
      });
    } else {
      form.reset(EMPTY_VALUES);
    }
  }, [open, setupDraft, form]);

  function close() {
    form.reset(EMPTY_VALUES);
    closeModal();
  }

  const pending = createSetup.isPending || updateSetup.isPending;

  const submitError =
    (createSetup.isError && createSetup.error instanceof Error
      ? createSetup.error.message
      : createSetup.isError
        ? "Save failed"
        : undefined) ??
    (updateSetup.isError && updateSetup.error instanceof Error
      ? updateSetup.error.message
      : updateSetup.isError
        ? "Save failed"
        : undefined);

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o && !pending) close();
      }}
      modal="trap-focus"
    >
      <DrawerContent>
        <DrawerHeader>
          <div className="min-w-0">
            <DrawerTitle>{isEdit ? "Edit setup" : "New setup"}</DrawerTitle>
            <DrawerDescription>
              {isEdit
                ? "Update the thesis, levels, and checklist — trades already logged keep their link."
                : "A planned playbook setup. Convert it to a trade when you take the shot."}
            </DrawerDescription>
          </div>
          <DrawerClose
            aria-label="Close"
            className="ml-auto flex cursor-pointer border-none bg-transparent p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={18} strokeWidth={1.5} />
          </DrawerClose>
        </DrawerHeader>
        <DrawerBody>
          <form
            id="new-setup-form"
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <form.Field
              name="name"
              validators={{
                onSubmit: ({ value }) => (!value.trim() ? "Name is required." : undefined),
              }}
            >
              {(field) => (
                <Field label="Name" htmlFor="ns-name" error={fieldError(field.state.meta.errors)}>
                  <FormInput
                    id="ns-name"
                    aria-label="Name"
                    autoFocus
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="e.g. Gap and Go"
                  />
                </Field>
              )}
            </form.Field>

            <div className="grid grid-cols-2 items-start gap-3">
              <form.Field name="symbol">
                {(field) => (
                  <Field label="Symbol" htmlFor="ns-symbol">
                    <FormInput
                      id="ns-symbol"
                      aria-label="Symbol"
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      // Uppercased here as well as on submit, so the field shows
                      // the ticker the way it will be stored.
                      onChange={(e) => field.handleChange(e.target.value.toUpperCase())}
                      placeholder="AAPL"
                      className="uppercase"
                    />
                  </Field>
                )}
              </form.Field>

              <form.Field name="direction">
                {(field) => (
                  <Field label="Direction">
                    <SegmentedControl
                      ariaLabel="Direction"
                      // `md` + fullWidth so the track matches the Symbol input's
                      // height and column width instead of sitting short and ragged.
                      size="md"
                      fullWidth
                      value={field.state.value}
                      onChange={(v) => field.handleChange(v as "long" | "short")}
                      options={[
                        { value: "long", label: "↗ LONG" },
                        { value: "short", label: "↘ SHORT" },
                      ]}
                      tones={{ long: "pos", short: "neg" }}
                    />
                  </Field>
                )}
              </form.Field>
            </div>

            <div className="grid grid-cols-2 items-start gap-3">
              <form.Field name="target">
                {(field) => (
                  <Field label="Target" htmlFor="ns-target">
                    <AmountInput
                      id="ns-target"
                      aria-label="Target"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onValueChange={field.handleChange}
                      placeholder="Optional"
                    />
                  </Field>
                )}
              </form.Field>

              <form.Field name="stop">
                {(field) => (
                  <Field label="Stop" htmlFor="ns-stop">
                    <AmountInput
                      id="ns-stop"
                      aria-label="Stop"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onValueChange={field.handleChange}
                      placeholder="Optional"
                    />
                  </Field>
                )}
              </form.Field>
            </div>

            <form.Field name="thesis">
              {(field) => (
                <Field label="Thesis" htmlFor="ns-thesis">
                  <FormTextarea
                    id="ns-thesis"
                    aria-label="Thesis"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Why this setup? Entry criteria, invalidation…"
                    rows={3}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="checklistText">
              {(field) => {
                const count = parseChecklist(field.state.value).length;
                return (
                  <Field
                    label="Checklist"
                    htmlFor="ns-check"
                    // Doubles as feedback: the line-per-item rule until there is
                    // something to count, then what the setup will actually save.
                    description={
                      count ? `${count} item${count === 1 ? "" : "s"}` : "One item per line."
                    }
                  >
                    <FormTextarea
                      id="ns-check"
                      aria-label="Checklist"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={"Above VWAP\nRelative volume > 2"}
                      rows={4}
                    />
                  </Field>
                );
              }}
            </form.Field>

            {submitError && (
              <p role="alert" className="m-0 text-xs text-destructive">
                {submitError}
              </p>
            )}
          </form>
        </DrawerBody>
        <DrawerFooter>
          <Button
            type="button"
            variant="outline"
            onClick={close}
            disabled={pending}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="new-setup-form"
            variant="default"
            loading={pending}
            disabled={pending}
            className="flex-1 sm:flex-none"
          >
            {isEdit ? "Save changes" : "Save setup"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
