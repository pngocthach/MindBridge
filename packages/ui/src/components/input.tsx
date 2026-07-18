import { cn } from "@MindBridge/ui/lib/utils";
import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<InputPrimitive
			className={cn(
				"h-11 w-full min-w-0 rounded-xl border border-input bg-white/90 px-4 py-2 text-sm shadow-sm outline-none transition-all file:inline-flex file:h-6 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-xs placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:bg-white focus-visible:ring-3 focus-visible:ring-ring/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 dark:bg-input/30 dark:disabled:bg-input/80",
				className,
			)}
			data-slot="input"
			type={type}
			{...props}
		/>
	);
}

export { Input };
