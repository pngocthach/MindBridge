import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AppShell from "./app-shell";

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
