import { Eye, EyeOff, X } from "lucide-react";
import { forwardRef, useId, useState, type ComponentProps } from "react";
import { cn } from "../lib/cn";
import { signalInputClass } from "./signal-field-styles";

export const SignalInput = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  function SignalInput({ className, ...props }, ref) {
    return <input ref={ref} className={cn(signalInputClass, className)} {...props} />;
  },
);

export const SignalTextarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(
  function SignalTextarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(signalInputClass, "h-auto min-h-[88px] resize-y py-2.5", className)}
        {...props}
      />
    );
  },
);

type SignalPasswordInputProps = Omit<ComponentProps<"input">, "type"> & {
  /** Accessible names for the show/hide control. */
  showLabel?: string;
  hideLabel?: string;
  /** Optional clear action shown when there is a value. */
  onClear?: () => void;
  clearLabel?: string;
};

/** Password / secret field with an eye toggle to reveal the value. */
export const SignalPasswordInput = forwardRef<HTMLInputElement, SignalPasswordInputProps>(
  function SignalPasswordInput(
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
        <input
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className={cn(signalInputClass, onClear ? "pr-[4.25rem]" : "pr-10", className)}
          {...props}
        />
        {onClear && hasValue ? (
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "absolute top-1/2 right-8 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center",
              "rounded-control border-none bg-transparent text-text-dim transition-colors duration-150",
              "hover:bg-bg-hover hover:text-text",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
              "disabled:cursor-not-allowed disabled:opacity-45",
            )}
            onClick={onClear}
            aria-label={clearLabel}
            aria-controls={inputId}
          >
            <X size={13} strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "absolute top-1/2 right-1 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center",
            "rounded-control border-none bg-transparent text-text-dim transition-colors duration-150",
            "hover:bg-bg-hover hover:text-text",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
            "disabled:cursor-not-allowed disabled:opacity-45",
          )}
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
        </button>
      </div>
    );
  },
);
