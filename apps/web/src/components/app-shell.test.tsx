import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AppShell from "./app-shell";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));

describe("AppShell", () => {
	it("shows the current role without exposing additional navigation", () => {
		const markup = renderToStaticMarkup(
			<AppShell name="Minh" onSignOut={async () => {}} userRole="teacher">
				<p>Nội dung</p>
			</AppShell>,
		);

		expect(markup).toContain("Giáo viên");
		expect(markup).toContain("Tổng quan");
		expect(markup).not.toContain("Quản trị");
	});
});
