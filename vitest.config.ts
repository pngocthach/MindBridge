import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		alias: {
			"@": new URL("./apps/web/src", import.meta.url).pathname,
		},
	},
});
