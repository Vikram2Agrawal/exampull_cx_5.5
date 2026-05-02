import { expect, type Page, test } from "@playwright/test";

async function assertNoHorizontalOverflow(page: Page) {
	const overflow = await page.evaluate(
		() =>
			Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
			window.innerWidth,
	);
	expect(Math.round(overflow)).toBeLessThanOrEqual(2);
}

test("landing page shows artifact-first CTA", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByRole("link", { name: "Generate your first exam" })).toBeVisible();
	await expect(page.getByTestId("exam-artifact-preview")).toBeVisible();
	await expect(
		page
			.getByTestId("exam-artifact-preview")
			.getByRole("heading", { name: "Thermodynamics and Entropy" }),
	).toBeVisible();
	const colorScheme = await page.evaluate(
		() => getComputedStyle(document.documentElement).colorScheme,
	);
	expect(colorScheme).toContain("dark");
	await assertNoHorizontalOverflow(page);
});

test("landing page keeps the paper artifact visible on mobile", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 720 });
	await page.goto("/");
	await expect(page.getByText("Generated Practice Examination", { exact: true })).toBeVisible();
	await expect(page.getByRole("link", { name: "Generate your first exam" })).toBeVisible();
	await assertNoHorizontalOverflow(page);
});

test("Firebase browser auth accepts the current origin", async ({ page }) => {
	await page.goto("/sign-in");
	await expect(page.getByTestId("exam-artifact-preview")).toBeVisible();
	await page
		.getByLabel("Email")
		.fill(`auth-smoke-${Date.now()}@missing-account.exampull.invalid`);
	await page.getByLabel("Password").fill("MissingAccountPassword123!");
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page.getByText("The email or password is not correct.")).toBeVisible();
	await expect(page.getByText(/unauthorized-domain/i)).toHaveCount(0);
});

test("admin routes are hidden without admin session", async ({ page }) => {
	const response = await page.goto("/admin");
	expect(response?.status()).toBe(404);
});
