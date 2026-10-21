import { chromium, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
const base = process.env.SPRITE_TEST_URL || "http://localhost:3004";
const sources = JSON.parse(
  await readFile("src/data/sprite-sources.json", "utf8"),
);
await mkdir(".artifacts/sprites", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/studio/demo");
  await page.getByRole("tab", { name: "Style", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rétro", exact: false }),
  ).toHaveAttribute("aria-disabled", "true");
  for (const source of sources) {
    await page
      .getByRole("combobox", { name: "Illustrations", exact: true })
      .selectOption(source.id);
    await expect(
      page.getByRole("combobox", { name: "Illustrations", exact: true }),
    ).toHaveValue(source.id);
    await expect
      .poll(
        () =>
          page
            .locator(".preview-overlay img.pokemon-image")
            .evaluateAll(
              (imgs) =>
                imgs.length === 5 &&
                imgs.every((i) => i.complete && i.naturalWidth > 0),
            ),
        { timeout: 15000 },
      )
      .toBe(true);
  }
  await page
    .getByRole("combobox", { name: "Illustrations", exact: true })
    .selectOption("red-blue");
  await page
    .getByRole("combobox", { name: "Vue", exact: true })
    .selectOption("back-transparent-gray");
  await expect(
    page.locator(".preview-overlay img.pokemon-image").first(),
  ).toHaveAttribute("src", /red-blue\/transparent\/back\/gray\/6.png$/);
  await page.reload();
  await page.getByRole("tab", { name: "Style", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Illustrations", exact: true }),
  ).toHaveValue("red-blue");
  await expect(
    page.getByRole("combobox", { name: "Vue", exact: true }),
  ).toHaveValue("back-transparent-gray");
  await page
    .getByRole("button", {
      name: "Modifier Dracaufeu, emplacement 1",
      exact: true,
    })
    .click();
  await page.getByLabel("Objet tenu", { exact: true }).fill("Restes");
  await page.getByRole("combobox", { name: "Sexe", exact: true }).selectOption("female");
  await page.getByRole("button", { name: "Appliquer", exact: true }).click();
  await page.getByRole("switch", { name: "Objets tenus", exact: true }).click();
  await expect(
    page.locator(".preview-overlay img.item-sprite").first(),
  ).toHaveAttribute("src", /leftovers.png$/);
  await page.screenshot({
    path: ".artifacts/sprites/variants-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: ".artifacts/sprites/variants-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  console.log(
    "39 illustration families, variant persistence, item icon, female selection and mobile layout passed.",
  );
  if (process.env.RETRO_PREVIEW_URL) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(process.env.RETRO_PREVIEW_URL);
    await page.getByRole("tab", { name: "Style", exact: true }).click();
    await page.getByRole("button", { name: "Rétro", exact: false }).click();
    await expect(page.locator(".preview-overlay .theme-retro")).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".preview-overlay .overlay-mon-info strong")
          .first()
          .evaluate((el) => getComputedStyle(el).fontFamily),
      )
      .toContain("Pixelify");
    await page.screenshot({
      path: ".artifacts/sprites/retro-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: ".artifacts/sprites/retro-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.goto(process.env.RETRO_PREVIEW_URL + "?mode=obs");
    await expect(page.locator(".obs-output .theme-retro")).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".obs-output img.pokemon-image")
          .evaluateAll(
            (imgs) =>
              imgs.length === 5 &&
              imgs.every((i) => i.complete && i.naturalWidth > 0),
          ),
      )
      .toBe(true);
    await page.screenshot({ path: ".artifacts/sprites/retro-obs.png" });
    // Isolated real hook, mocked entitlement endpoint; no production account is created.
    let calls = 0;
    await page.route("**/api/overlay/*/access", async (route) => {
      calls++;
      if (calls === 1)
        return route.fulfill({
          json: { active: true, expiresAt: Date.now() + 500 },
        });
      return route.fulfill({ status: 503, json: { active: false } });
    });
    await page.goto(process.env.RETRO_PREVIEW_URL + "?mode=access");
    await expect(page.getByTestId("access")).toHaveText("active");
    await expect(page.getByTestId("access")).toHaveText("inactive", {
      timeout: 3000,
    });
    await expect.poll(() => calls, { timeout: 15000 }).toBeGreaterThan(1);
    await expect(page.getByTestId("access")).toHaveText("inactive");
    console.log(
      "Isolated Pro studio/OBS render and automatic expiry/fail-closed checks passed.",
    );
  }
} finally {
  await browser.close();
}
