import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		alias: {
			"@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
		},
		exclude: [...configDefaults.exclude, "**/dist/**"],
		setupFiles: ["./vitest.setup.ts"],
	},
});
