import { bindings, defineConfig } from "cf/config";

import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
	accountId: "c605d712b51666faef93b68449cbc470",
	worker: {
		name: "og-generator",
		compatibilityDate: "2026-10-01",
		compatibilityFlags: [
			"nodejs_compat",
		],
		entrypoint,
		workersDev: false,
		previewUrls: false,
		placement: {
			mode: "smart",
		},
		observability: {
			enabled: true,
		},
		env: {
			FONTS: bindings.r2({
				name: "fonts",
			}),
		},
	},
});
