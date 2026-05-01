import { expect, test } from "@playwright/test";

test("landing page shows artifact-first CTA", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByRole("link", { name: "Generate your first exam" })).toBeVisible();
	await expect(page.getByText("Thermodynamics and Entropy")).toBeVisible();
});

test("admin routes are hidden without admin session", async ({ page }) => {
	const response = await page.goto("/admin");
	expect(response?.status()).toBe(404);
});
