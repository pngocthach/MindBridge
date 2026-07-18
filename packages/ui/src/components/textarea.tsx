import { cn } from "@MindBridge/ui/lib/utils";
import type * as React from "react";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			className={cn(
				"field-sizing-content flex min-h-24 w-full resize-none rounded-xl border border-input bg-white/90 px-4 py-3 text-sm shadow-sm outline-none transition-all placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:bg-white focus-visible:ring-3 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 dark:bg-input/30 dark:disabled:bg-input/80",
				className,
			)}
			data-slot="textarea"
			{...props}
		/>
	);
}

export { Textarea };
