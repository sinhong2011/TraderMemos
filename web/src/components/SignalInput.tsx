import { forwardRef } from "react";
import { cn } from "../lib/cn";
import { signalInputClass } from "./signal-field-styles";

export const SignalInput = forwardRef<
	HTMLInputElement,
	React.ComponentProps<"input">
>(function SignalInput({ className, ...props }, ref) {
	return (
		<input
			ref={ref}
			className={cn(signalInputClass, "h-8 py-1.5", className)}
			{...props}
		/>
	);
});

export const SignalTextarea = forwardRef<
	HTMLTextAreaElement,
	React.ComponentProps<"textarea">
>(function SignalTextarea({ className, ...props }, ref) {
	return (
		<textarea
			ref={ref}
			className={cn(signalInputClass, "min-h-[80px] resize-y py-2", className)}
			{...props}
		/>
	);
});
