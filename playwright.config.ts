import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	timeout: 60_000,
	expect: { timeout: 10_000 },
	use: {
		baseURL:
			process.env.TEST_BASE_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3100",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "desktop-chrome",
			use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } },
		},
		{
			name: "desktop-safari",
			use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 720 } },
		},
		{ name: "mobile-safari", use: { ...devices["iPhone 14"] } },
		{ name: "mobile-android", use: { ...devices["Pixel 7"] } },
	],
	webServer: {
		command:
			"TEST_SESSION_API_ENABLED=true WEB_URL= CLOUD_TASKS_INVOKER_SA= pnpm exec next dev --turbopack -p 3100",
		url: "http://localhost:3100",
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
