import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { seedExam, signInAsTestUser } from "./test-auth";

declare global {
	interface Window {
		__exampullQualityMetrics?: {
			largestContentfulPaint: number;
			cumulativeLayoutShift: number;
		};
	}
}

type Theme = "dark" | "light";

type QualityRoute = {
	path: string;
	heading: string;
	expectPaper: boolean;
};

type QualityViewport = {
	name: "desktop" | "mobile";
	width: number;
	height: number;
};

const qualityArtifactRoot = join(process.cwd(), "artifacts", "quality");
const visualViewports: QualityViewport[] = [
	{ name: "desktop", width: 1280, height: 720 },
	{ name: "mobile", width: 390, height: 664 },
];

test.skip(
	Boolean(process.env.TEST_BASE_URL) && process.env.TEST_SESSION_API_ENABLED !== "true",
	"Local quality E2E uses authenticated test-session helpers.",
);

function slug(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 120);
}

async function waitForPageReady(page: Page) {
	await expect(page.locator("#main-content")).toBeVisible();
	await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
	await page.waitForTimeout(100);
}

async function setTheme(page: Page, theme: Theme) {
	const response = await page.context().request.patch("/api/settings/profile", {
		data: {
			displayName: `Quality ${theme}`,
			notificationEmail: true,
			notificationProduct: true,
			theme,
		},
	});
	expect(response.status()).toBe(200);
}

async function captureScreenshot(page: Page, testInfo: TestInfo, name: string) {
	mkdirSync(qualityArtifactRoot, { recursive: true });
	const filePath = join(qualityArtifactRoot, `${slug(testInfo.title)}-${slug(name)}.png`);
	const screenshot = await page.screenshot({
		fullPage: true,
		animations: "disabled",
		path: filePath,
	});
	await testInfo.attach(name, {
		path: filePath,
		contentType: "image/png",
	});

	return screenshot.length;
}

async function assertNoHorizontalOverflow(page: Page) {
	const overflow = await page.evaluate(() => {
		const scrollWidth = Math.max(
			document.documentElement.scrollWidth,
			document.body.scrollWidth,
		);

		return Math.round(scrollWidth - window.innerWidth);
	});
	expect(overflow).toBeLessThanOrEqual(2);
}

async function assertNoControlTextOverflow(page: Page) {
	const overflowingControls = await page.evaluate(() =>
		Array.from(document.querySelectorAll<HTMLElement>("button, a[href], [role='button']"))
			.filter((element) => {
				const rect = element.getBoundingClientRect();
				const style = window.getComputedStyle(element);

				return (
					rect.width > 0 &&
					rect.height > 0 &&
					style.display !== "none" &&
					style.visibility !== "hidden" &&
					element.scrollWidth > element.clientWidth + 1
				);
			})
			.map(
				(element) =>
					`${element.tagName.toLowerCase()} ${(
						element.getAttribute("aria-label") ??
						element.textContent ??
						""
					)
						.trim()
						.replace(/\s+/g, " ")}`,
			)
			.slice(0, 10),
	);
	expect(overflowingControls).toEqual([]);
}

async function assertMobileTouchTargets(page: Page) {
	const smallTargets = await page.evaluate(() =>
		Array.from(
			document.querySelectorAll<HTMLElement>(
				"button, input, select, textarea, a[href], [role='button']",
			),
		)
			.filter((element) => {
				const rect = element.getBoundingClientRect();
				const style = window.getComputedStyle(element);

				if (
					rect.width === 0 ||
					rect.height === 0 ||
					style.display === "none" ||
					style.visibility === "hidden"
				) {
					return false;
				}

				if (
					element instanceof HTMLInputElement &&
					["checkbox", "radio", "file", "hidden"].includes(element.type)
				) {
					return false;
				}

				return rect.width < 44 || rect.height < 44;
			})
			.map((element) => {
				const rect = element.getBoundingClientRect();

				return `${element.tagName.toLowerCase()} ${(
					element.getAttribute("aria-label") ??
					element.textContent ??
					""
				)
					.trim()
					.replace(/\s+/g, " ")} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
			})
			.slice(0, 10),
	);
	expect(smallTargets).toEqual([]);
}

async function assertMaterialDiscipline(page: Page, route: QualityRoute) {
	const materialReport = await page.evaluate(() => {
		const glassSelector = ".bg-glass, .bg-glass-strong";
		const glassElements = Array.from(document.querySelectorAll<HTMLElement>(glassSelector));
		let maxGlassDepth = 0;

		for (const element of glassElements) {
			let depth = 0;
			let current: HTMLElement | null = element;

			while (current) {
				if (current.matches(glassSelector)) {
					depth += 1;
				}
				current = current.parentElement;
			}

			maxGlassDepth = Math.max(maxGlassDepth, depth);
		}

		return {
			glassCount: glassElements.length,
			paperCount: document.querySelectorAll(".bg-paper").length,
			maxGlassDepth,
		};
	});

	expect(materialReport.glassCount).toBeGreaterThan(0);
	expect(materialReport.maxGlassDepth).toBeLessThanOrEqual(3);

	if (route.expectPaper) {
		expect(materialReport.paperCount).toBeGreaterThan(0);
	}
}

async function installPerformanceObservers(page: Page) {
	await page.addInitScript(() => {
		window.__exampullQualityMetrics = {
			largestContentfulPaint: 0,
			cumulativeLayoutShift: 0,
		};

		if (!("PerformanceObserver" in window)) {
			return;
		}

		try {
			const lcpObserver = new PerformanceObserver((list) => {
				const entries = list.getEntries();
				const lastEntry = entries[entries.length - 1];

				if (lastEntry) {
					window.__exampullQualityMetrics = {
						largestContentfulPaint: lastEntry.startTime,
						cumulativeLayoutShift:
							window.__exampullQualityMetrics?.cumulativeLayoutShift ?? 0,
					};
				}
			});
			lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
		} catch {
			window.__exampullQualityMetrics.largestContentfulPaint = 0;
		}

		try {
			const clsObserver = new PerformanceObserver((list) => {
				let cumulativeLayoutShift =
					window.__exampullQualityMetrics?.cumulativeLayoutShift ?? 0;

				for (const entry of list.getEntries()) {
					const shift = entry as PerformanceEntry & {
						value?: number;
						hadRecentInput?: boolean;
					};

					if (!shift.hadRecentInput) {
						cumulativeLayoutShift += shift.value ?? 0;
					}
				}

				window.__exampullQualityMetrics = {
					largestContentfulPaint:
						window.__exampullQualityMetrics?.largestContentfulPaint ?? 0,
					cumulativeLayoutShift,
				};
			});
			clsObserver.observe({ type: "layout-shift", buffered: true });
		} catch {
			window.__exampullQualityMetrics.cumulativeLayoutShift = 0;
		}
	});
}

async function readPerformanceMetrics(page: Page) {
	return page.evaluate(() => {
		const firstContentfulPaint =
			performance
				.getEntriesByType("paint")
				.find((entry) => entry.name === "first-contentful-paint")?.startTime ?? 0;
		const navigation = performance.getEntriesByType("navigation")[0];
		const loadComplete =
			navigation instanceof PerformanceNavigationTiming
				? navigation.loadEventEnd - navigation.startTime
				: performance.now();
		const stored = window.__exampullQualityMetrics;

		return {
			firstContentfulPaint,
			largestContentfulPaint:
				stored?.largestContentfulPaint || firstContentfulPaint || loadComplete,
			cumulativeLayoutShift: stored?.cumulativeLayoutShift ?? 0,
		};
	});
}

test("primary screens preserve atelier and artifact quality across themes and viewports", async ({
	page,
}, testInfo) => {
	test.setTimeout(180_000);
	const email = `quality-visual-${Date.now()}@exampull.test`;
	await signInAsTestUser(page, email, { tier: "guru", credits: 500 });
	const examTitle = "Quality visual seeded exam";
	const examId = await seedExam(page, examTitle);
	const routes: QualityRoute[] = [
		{ path: "/dashboard", heading: "Your exam atelier", expectPaper: true },
		{ path: "/exams", heading: "Exam library", expectPaper: true },
		{ path: "/exams/new", heading: "Create an exam", expectPaper: false },
		{ path: `/exams/${examId}`, heading: examTitle, expectPaper: true },
		{ path: "/settings", heading: "Settings", expectPaper: false },
	];

	for (const theme of ["dark", "light"] as const) {
		await setTheme(page, theme);

		for (const viewport of visualViewports) {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });

			for (const route of routes) {
				await page.goto(route.path, { waitUntil: "domcontentloaded" });
				await waitForPageReady(page);

				await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
				await expect(page.locator(`.${theme}`).first()).toBeVisible();

				if (viewport.name === "mobile") {
					await expect(
						page.getByRole("navigation", { name: "Mobile application" }),
					).toBeVisible();
					await assertMobileTouchTargets(page);
				}

				await assertNoHorizontalOverflow(page);
				await assertNoControlTextOverflow(page);
				await assertMaterialDiscipline(page, route);

				const size = await captureScreenshot(
					page,
					testInfo,
					`${theme}-${viewport.name}-${slug(route.path) || "dashboard"}`,
				);
				expect(size).toBeGreaterThan(5_000);
			}
		}
	}
});

test("primary screens meet paint, layout-shift, and action-feedback budgets", async ({
	page,
}, testInfo) => {
	test.setTimeout(120_000);
	await installPerformanceObservers(page);
	await signInAsTestUser(page, `quality-perf-${Date.now()}@exampull.test`, {
		tier: "guru",
		credits: 500,
	});
	const examId = await seedExam(page, "Quality performance seeded exam");
	const routes = ["/dashboard", "/exams", "/exams/new", `/exams/${examId}`];
	const measurements: {
		path: string;
		firstContentfulPaint: number;
		largestContentfulPaint: number;
		cumulativeLayoutShift: number;
	}[] = [];

	await setTheme(page, "dark");
	await page.setViewportSize({ width: 1280, height: 720 });

	for (const path of routes) {
		await page.goto(path, { waitUntil: "domcontentloaded" });
		await waitForPageReady(page);
		const metrics = await readPerformanceMetrics(page);
		measurements.push({ path, ...metrics });

		expect(metrics.largestContentfulPaint).toBeLessThan(2_500);
		expect(metrics.cumulativeLayoutShift).toBeLessThan(0.1);
	}

	await page.goto("/exams", { waitUntil: "domcontentloaded" });
	await waitForPageReady(page);
	const actionFeedbackMs = await page.evaluate(async () => {
		const listViewButton = document.querySelector<HTMLButtonElement>(
			'button[aria-label="List view"]',
		);

		if (!listViewButton) {
			return -1;
		}

		const startedAt = performance.now();
		listViewButton.click();
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => resolve());
			});
		});

		return performance.now() - startedAt;
	});
	expect(actionFeedbackMs).toBeGreaterThanOrEqual(0);
	expect(actionFeedbackMs).toBeLessThan(200);
	await expect(page.getByRole("link", { name: "Quality performance seeded exam" })).toBeVisible();

	mkdirSync(qualityArtifactRoot, { recursive: true });
	const metricsPath = join(
		qualityArtifactRoot,
		`${slug(testInfo.title)}-performance-metrics.json`,
	);
	writeFileSync(metricsPath, JSON.stringify({ measurements, actionFeedbackMs }, null, 2), "utf8");
	await testInfo.attach("performance-metrics", {
		path: metricsPath,
		contentType: "application/json",
	});
});
