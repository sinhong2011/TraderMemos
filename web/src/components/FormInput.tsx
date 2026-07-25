import { Eye, EyeOff, X } from "lucide-react";
import { forwardRef, useId, useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

export const FormInput = forwardRef<HTMLInputElement, ComponentProps<"input">>(function FormInput(
  { className, ...props },
  ref,
) {
  return <Input ref={ref} className={cn("w-full", className)} {...props} />;
});

export const FormTextarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(
  function FormTextarea({ className, ...props }, ref) {
    return <Textarea ref={ref} className={cn("w-full resize-y", className)} {...props} />;
  },
);

type PasswordInputProps = Omit<ComponentProps<"input">, "type"> & {
  /** Accessible names for the show/hide control. */
  showLabel?: string;
  hideLabel?: string;
  /** Optional clear action shown when there is a value. */
  onClear?: () => void;
  clearLabel?: string;
};

/** Password / secret field with an eye toggle to reveal the value. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      className,
      disabled,
      showLabel = "Show value",
      hideLabel = "Hide value",
      onClear,
      clearLabel = "Clear value",
      id,
      ...props
    },
    ref,
  ) {
    const [visible, setVisible] = useState(false);
    const reactId = useId();
    const inputId = id ?? reactId;
    const hasValue = typeof props.value === "string" && props.value.length > 0;

    return (
      <div className="relative w-full min-w-0">
        <Input
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className={cn(
            "w-full",
            onClear ? "*:data-[slot=input]:pe-16" : "*:data-[slot=input]:pe-10",
            className,
          )}
          {...props}
        />
        {onClear && hasValue ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            className="absolute top-1/2 right-8 z-10 -translate-y-1/2 text-muted-foreground disabled:opacity-45"
            onClick={onClear}
            aria-label={clearLabel}
            aria-controls={inputId}
          >
            <X size={13} strokeWidth={1.75} aria-hidden />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          className="absolute top-1/2 right-1 z-10 -translate-y-1/2 text-muted-foreground disabled:opacity-45"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          aria-controls={inputId}
        >
          {visible ? (
            <EyeOff size={14} strokeWidth={1.75} aria-hidden />
          ) : (
            <Eye size={14} strokeWidth={1.75} aria-hidden />
          )}
        </Button>
      </div>
    );
  },
);
