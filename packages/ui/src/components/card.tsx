import { cn } from "@MindBridge/ui/lib/utils";
import type * as React from "react";

function Card({
	className,
	size = "default",
	...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
	return (
		<div
			className={cn(
				"group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-2xl border border-border/80 bg-card/95 py-(--card-spacing) text-card-foreground text-sm/relaxed shadow-[0_8px_24px_oklch(0.3_0.06_255/8%)] backdrop-blur-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_12px_28px_oklch(0.3_0.08_255/12%)] [--card-spacing:--spacing(4)] has-[>img:first-child]:pt-0 has-data-[slot=card-footer]:pb-0 data-[size=sm]:has-data-[slot=card-footer]:pb-0 data-[size=sm]:[--card-spacing:--spacing(3)] *:[img:first-child]:rounded-t-2xl *:[img:last-child]:rounded-b-2xl",
				className,
			)}
			data-size={size}
			data-slot="card"
			{...props}
		/>
	);
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"group/card-header @container/card-header grid auto-rows-min items-start gap-1.5 px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
				className,
			)}
			data-slot="card-header"
			{...props}
		/>
	);
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"cn-font-heading font-semibold text-base tracking-tight group-data-[size=sm]/card:text-sm",
				className,
			)}
			data-slot="card-title"
			{...props}
		/>
	);
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("text-muted-foreground text-sm/relaxed", className)}
			data-slot="card-description"
			{...props}
		/>
	);
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"col-start-2 row-span-2 row-start-1 self-start justify-self-end",
				className,
			)}
			data-slot="card-action"
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("px-(--card-spacing)", className)}
			data-slot="card-content"
			{...props}
		/>
	);
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex items-center border-t bg-muted/25 p-(--card-spacing)",
				className,
			)}
			data-slot="card-footer"
			{...props}
		/>
	);
}

export {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
};
