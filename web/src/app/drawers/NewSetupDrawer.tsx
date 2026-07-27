import { useForm } from "@tanstack/react-form";
import { X } from "lucide-react";
import { useEffect } from "react";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/Drawer";
import { ModalBanner } from "@/components/Modal";
import { SegmentedControl } from "@/components/SegmentedControl";
import { fieldError, Field } from "@/components/Field";
import { FormInput, FormTextarea } from "@/components/FormInput";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { useCreateSetup, useUpdateSetup } from "@/lib/hooks/useSetups";
import { useUI } from "@/lib/ui";

function parseOptionalNum(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
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
      const checklist = value.checklistText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const body = {
        name: value.name.trim(),
        description: value.thesis.trim(),
        thesis: value.thesis.trim(),
        symbol: value.symbol.trim().toUpperCase() || undefined,
        direction: value.direction,
        target_price: parseOptionalNum(value.target),
        stop_price: parseOptionalNum(value.stop),
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

  const footer = (
    <div className="flex w-full justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onClick={close} disabled={pending}>
        Cancel
      </Button>
      <Button type="submit" form="new-setup-form" variant="default" disabled={pending}>
        {pending ? "Saving…" : isEdit ? "Save changes" : "Save setup"}
      </Button>
    </div>
  );

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
          <DrawerTitle>{isEdit ? "Edit Setup" : "New Setup"}</DrawerTitle>
          <DrawerClose
            aria-label="Close"
            className="ml-auto flex cursor-pointer border-none bg-transparent p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={18} strokeWidth={1.5} />
          </DrawerClose>
        </DrawerHeader>
        <DrawerBody>
          <ModalBanner>
            {isEdit
              ? "Update thesis, levels, and checklist. Log a trade from the playbook when you take the shot."
              : "Define a planned playbook setup — thesis, levels, and checklist. Convert it to a trade when you take the shot."}
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
                onSubmit: ({ value }) => (!value.trim() ? "Name is required." : undefined),
              }}
            >
              {(field) => (
                <Field label="Name" htmlFor="ns-name" error={fieldError(field.state.meta.errors)}>
                  <FormInput
                    id="ns-name"
                    aria-label="Name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="e.g. Gap and Go"
                  />
                </Field>
              )}
            </form.Field>

            <div className="grid grid-cols-2 gap-3">
              <form.Field name="symbol">
                {(field) => (
                  <Field label="Symbol" htmlFor="ns-symbol">
                    <FormInput
                      id="ns-symbol"
                      aria-label="Symbol"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="AAPL"
                    />
                  </Field>
                )}
              </form.Field>

              <form.Field name="direction">
                {(field) => (
                  <Field label="Direction">
                    <SegmentedControl
                      ariaLabel="Direction"
                      value={field.state.value}
                      onChange={(v) => field.handleChange(v as "long" | "short")}
                      options={[
                        { value: "long", label: "LONG" },
                        { value: "short", label: "SHORT" },
                      ]}
                    />
                  </Field>
                )}
              </form.Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <form.Field name="target">
                {(field) => (
                  <Field label="Target" htmlFor="ns-target">
                    <FormInput
                      id="ns-target"
                      aria-label="Target"
                      inputMode="decimal"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </Field>
                )}
              </form.Field>

              <form.Field name="stop">
                {(field) => (
                  <Field label="Stop" htmlFor="ns-stop">
                    <FormInput
                      id="ns-stop"
                      aria-label="Stop"
                      inputMode="decimal"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
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
              {(field) => (
                <Field label="Checklist (one item per line)" htmlFor="ns-check">
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
              )}
            </form.Field>

            {submitError && <p className="m-0 text-xs text-destructive">{submitError}</p>}
          </form>
        </DrawerBody>
        <DrawerFooter>{footer}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
