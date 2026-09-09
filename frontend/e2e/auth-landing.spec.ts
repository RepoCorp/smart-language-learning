import { expect, test } from "@playwright/test";

test("shows the public sign-in and registration entry points", async ({ page }) => {
  await page.route("**/api/auth/bootstrap-status*", async (route) => {
    await route.fulfill({
      json: { can_public_register: true },
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await expect(page.getByPlaceholder("Username or email")).toBeVisible();
  await expect(page.getByPlaceholder("PIN")).toBeVisible();
  await page.getByRole("button", { name: "Request registration" }).click();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();
});
