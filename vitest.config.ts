import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		alias: {
			"@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
		},
	},
});
