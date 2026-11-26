/**
 * Screenshots of every screen (AC-15.1). Run against a local build with fixture AI and fake email:
 *   BASE_URL=http://localhost:3200 PASSCODE=devpass pnpm screenshots
 * Optional CHROME_PATH points at an existing Chromium. Writes docs/screenshots/*.png.
 */
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const PASSCODE = process.env.PASSCODE ?? "";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const shot = async (page: Page, name: string, fullPage = true) => {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
  console.log("saved", name);
};

async function main() {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  await page.goto(BASE);
  await shot(page, "01-home-empty");

  await page.getByRole("button", { name: "Use sample data" }).click();
  await page.waitForURL(/\/batches\/[^/]+$/);
  await page.getByText("Exposed by project").waitFor();
  const batchUrl = page.url();
  await shot(page, "02-batch-dashboard");

  await page.locator("tbody tr").nth(1).locator("span[tabindex]").first().hover();
  await page.waitForTimeout(400);
  await shot(page, "03-reason-tooltip", false);

  await page.getByRole("radio", { name: /^Hold/ }).click();
  await page.getByLabel("Project").selectOption({ label: "Parkway Retail Center" }).catch(() => undefined);
  await shot(page, "04-dashboard-filtered", false);

  await page.goto(`${batchUrl}/payments/PAY-02`);
  await shot(page, "05-payment-detail");
  await page.goto(`${batchUrl}/payments/PAY-11`);
  await shot(page, "06-payment-needs-review");
  await page.goto(`${batchUrl}/payments/PAY-12`);
  await shot(page, "07-payment-injection");

  await page.goto(batchUrl);
  await page.getByRole("button", { name: /Draft follow-up emails/ }).click();
  await page.waitForURL(/\/drafts$/);
  await page.locator("article").first().waitFor();
  await shot(page, "08-emails-locked");

  await page.getByRole("button", { name: /Demo access/ }).click();
  await page.waitForTimeout(250);
  await shot(page, "09-demo-access-popover", false);
  await page.getByLabel("Your name").fill("Aya");
  await page.getByLabel("Demo passcode").fill(PASSCODE);
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(300);

  const first = page.locator("article").first();
  await first.getByRole("button", { name: "Approve" }).click();
  await page.waitForTimeout(800);
  await page.locator("article").first().getByRole("button", { name: "Send" }).click();
  await page.waitForTimeout(1200);
  await page.locator("article").nth(1).getByLabel("Email body").fill("Hi, please send the waiver for $99,999.00 by Friday.");
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "10-emails-review", false);

  await page.goto(`${batchUrl}/audit`);
  await shot(page, "11-audit-log");
  await page.goto(`${BASE}/about`);
  await shot(page, "12-how-it-works");
  await page.goto(BASE);
  await shot(page, "13-home");

  // Processing view: an uploaded batch whose extractions are slowed down so progress is visible.
  const form = new FormData();
  form.set("name", "December payments (upload)");
  form.set("payments", new Blob([readFileSync("samples/payments.xlsx")]), "payments.xlsx");
  form.set("subcontractors", new Blob([readFileSync("samples/subcontractors.xlsx")]), "subcontractors.xlsx");
  const created = (await (await fetch(`${BASE}/api/batches`, { method: "POST", headers: { "x-demo-passcode": PASSCODE }, body: form })).json()) as { id: string };
  for (const f of readdirSync("samples/pdfs").filter((x) => x.endsWith(".pdf")).sort()) {
    const one = new FormData();
    one.set("file", new Blob([readFileSync(join("samples/pdfs", f))], { type: "application/pdf" }), f);
    await fetch(`${BASE}/api/batches/${created.id}/documents`, { method: "POST", headers: { "x-demo-passcode": PASSCODE }, body: one });
  }
  let n = 0;
  await page.route("**/extract", async (route) => {
    n++;
    await new Promise((r) => setTimeout(r, n <= 6 ? 50 : 60_000));
    await route.continue().catch(() => undefined);
  });
  await page.goto(`${BASE}/batches/${created.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, "14-processing.png"), fullPage: true });
  console.log("saved 14-processing");
  await page.unrouteAll({ behavior: "ignoreErrors" });

  const narrow = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const p2 = await narrow.newPage();
  await p2.goto(batchUrl);
  await p2.keyboard.press("Tab");
  await shot(p2, "15-dashboard-1280");
  for (let i = 0; i < 12; i++) await p2.keyboard.press("Tab");
  await p2.screenshot({ path: join(OUT, "16-keyboard-focus.png") });
  console.log("saved 16-keyboard-focus");

  // A deleted batch in a dark-mode browser: the app's own not-found page, logo still visible.
  const dark = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "dark" });
  const p3 = await dark.newPage();
  await p3.goto(`${BASE}/batches/deleted-batch-id/audit`);
  await shot(p3, "17-not-found-dark-mode", false);

  await browser.close();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
