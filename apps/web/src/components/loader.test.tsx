import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Loader from "./loader";

describe("Loader", () => {
	it("announces loading status to assistive technology", () => {
		const markup = renderToStaticMarkup(<Loader />);

		expect(markup).toContain('role="status"');
		expect(markup).toContain("Đang tải");
	});
});
