import { forwardRef } from "react";
import { cn } from "../lib/cn";
import { signalInputClass } from "./signal-field-styles";

export const SignalInput = forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function SignalInput({ className, ...props }, ref) {
    return <input ref={ref} className={cn(signalInputClass, className)} {...props} />;
  },
);

export const SignalTextarea = forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
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
