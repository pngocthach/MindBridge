import { Button } from "@MindBridge/ui/components/button";
import { X } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef } from "react";

const FOCUSABLE_SELECTOR =
	'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type ConfirmActionDialogProps = {
	confirmLabel: string;
	description: string;
	isPending?: boolean;
	onCancel: () => void;
	onConfirm: () => void;
	open: boolean;
	title: string;
};

export default function ConfirmActionDialog({
	confirmLabel,
	description,
	isPending = false,
	onCancel,
	onConfirm,
	open,
	title,
}: ConfirmActionDialogProps) {
	const cancelButtonRef = useRef<HTMLButtonElement>(null);
	const descriptionId = useId();
	const titleId = useId();

	useEffect(() => {
		if (open) {
			cancelButtonRef.current?.focus();
		}
	}, [open]);

	if (!open) {
		return null;
	}

	const dismiss = () => {
		if (!isPending) {
			onCancel();
		}
	};
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Escape") {
			event.preventDefault();
			dismiss();
			return;
		}
		if (event.key !== "Tab") {
			return;
		}
		const focusableElements = [
			...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
		];
		const firstElement = focusableElements[0];
		const lastElement = focusableElements.at(-1);
		if (!(firstElement && lastElement)) {
			return;
		}
		if (event.shiftKey && document.activeElement === firstElement) {
			event.preventDefault();
			lastElement.focus();
		} else if (!event.shiftKey && document.activeElement === lastElement) {
			event.preventDefault();
			firstElement.focus();
		}
	};

	return (
		<div
			aria-describedby={descriptionId}
			aria-labelledby={titleId}
			aria-modal="true"
			className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
			onKeyDown={handleKeyDown}
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) {
					dismiss();
				}
			}}
			role="dialog"
		>
			<div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-2xl">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 className="font-bold text-lg" id={titleId}>
							{title}
						</h2>
						<p
							className="mt-2 text-muted-foreground text-sm leading-6"
							id={descriptionId}
						>
							{description}
						</p>
					</div>
					<Button
						aria-label="Đóng hộp thoại"
						disabled={isPending}
						onClick={dismiss}
						size="icon-sm"
						type="button"
						variant="ghost"
					>
						<X aria-hidden="true" />
					</Button>
				</div>
				<div className="mt-6 flex justify-end gap-3">
					<Button
						disabled={isPending}
						onClick={dismiss}
						ref={cancelButtonRef}
						type="button"
						variant="outline"
					>
						Hủy
					</Button>
					<Button
						disabled={isPending}
						onClick={onConfirm}
						type="button"
						variant="destructive"
					>
						{isPending ? "Đang xử lý…" : confirmLabel}
					</Button>
				</div>
			</div>
		</div>
	);
}
