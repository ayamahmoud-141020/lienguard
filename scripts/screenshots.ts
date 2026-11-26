/**
 * README screenshots, in the order a reviewer walks through the demo. Run against a local build
 * with recorded AI readings and a fake email sender (no AI calls, no real email):
 *   LIENGUARD_AI=fixture LIENGUARD_EMAIL=fake DEMO_PASSCODE=<local test value> pnpm start -p 3200
 *   BASE_URL=http://localhost:3200 PASSCODE=<same value> CHROME_PATH=<chromium> pnpm screenshots
 * Writes docs/screenshots/NN-*.png. Toasts are hidden so nothing covers the page.
 */
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const PASSCODE = process.env.PASSCODE ?? "";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const HIDE_TOASTS = "[data-sonner-toaster]{display:none!important}";

/** Adds or removes a style that hides toasts (kept in one tag so it can be removed again). */
async function hideToasts(page: Page, hide: boolean) {
  await page.evaluate(
    ([css, on]) => {
      document.getElementById("hide-toasts")?.remove();
      if (!on) return;
      const el = document.createElement("style");
      el.id = "hide-toasts";
      el.textContent = css as string;
      document.head.appendChild(el);
    },
    [HIDE_TOASTS, hide] as const,
  );
}

async function shot(page: Page, name: string, fullPage = true) {
  await page.waitForLoadState("networkidle");
  await hideToasts(page, true);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
  console.log("saved", name);
}

/** Approves and sends the selected email, and waits until the list shows it as sent. */
async function approveAndSend(page: Page, sub: RegExp) {
  const item = page.getByRole("navigation", { name: "Subcontractors" }).getByRole("button", { name: sub });
  await item.click();
  await page.locator("article").getByRole("button", { name: "Approve", exact: true }).click();
  await item.getByText("Approved").waitFor();
  await page.locator("article").getByRole("button", { name: "Send", exact: true }).click();
  await item.getByText("Sent").waitFor();
}

async function main() {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // 1. Start: one click on sample data, no passcode.
  await page.goto(BASE);
  await page.getByRole("button", { name: "Use sample data" }).click();
  await page.waitForURL(/\/batches\/[^/]+$/);
  await page.getByText("Exposed by project").waitFor();
  const batchUrl = page.url();
  await shot(page, "02-batch-dashboard");

  // Home: the hero and the loop (the batch list below changes with every visitor, so it is cropped).
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  await hideToasts(page, true);
  await page.screenshot({ path: join(OUT, "01-home.png"), clip: { x: 0, y: 0, width: 1440, height: 470 } });
  console.log("saved 01-home");

  // 2. Why a payment is on hold, and what the AI read.
  await page.goto(batchUrl);
  await page.getByRole("radio", { name: /^Hold/ }).click();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2,h3,p,div")].find((e) => e.childElementCount === 0 && e.textContent?.trim() === "Payments");
    h?.scrollIntoView({ block: "start" });
    window.scrollBy(0, -90);
  });
  await shot(page, "03-payments-on-hold", false);
  await page.goto(`${batchUrl}/payments/PAY-02`);
  await shot(page, "04-payment-detail");
  await page.goto(`${batchUrl}/payments/PAY-11`);
  await shot(page, "05-payment-blurry-scan");
  await page.goto(`${batchUrl}/payments/PAY-12`);
  await shot(page, "06-payment-prompt-injection");

  // 3. Emails are ready at once (recorded wording), filled and checked by code.
  await page.goto(`${batchUrl}/drafts`);
  await page.locator("article").first().waitFor();
  await shot(page, "07-emails-ready", false);

  // Unlock demo access (local test passcode), then edit, approve and send.
  await page.getByRole("button", { name: /Demo access/ }).click();
  await page.getByLabel("Your name").fill("Aya");
  await page.getByLabel("Demo passcode").fill(PASSCODE);
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("navigation", { name: "Subcontractors" }).getByRole("button").nth(1).click();
  await page.locator("article").getByRole("button", { name: "Edit" }).click();
  await page.locator("article").getByLabel("Email body").fill("Hi, please send the waiver for $99,999.00 by Friday.");
  await hideToasts(page, false);
  await page.locator("article").getByRole("button", { name: "Save edit" }).click();
  await page.getByText(/Saved with \d+ warning/).waitFor();
  await page.waitForTimeout(400);
  // The warning is a toast, so this one screenshot keeps toasts visible.
  await page.screenshot({ path: join(OUT, "08-email-postcheck-warning.png") });
  console.log("saved 08-email-postcheck-warning");
  await page.waitForTimeout(4500);
  await page.locator("article").getByRole("button", { name: "Cancel" }).click({ timeout: 1000 }).catch(() => undefined);
  await approveAndSend(page, /BlueLine/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "09-email-sent", false);
  // Granite gets its email too; it never replies, so the daily check drafts a reminder 3 days later.
  await approveAndSend(page, /Granite/);

  // 4. The loop: a reply arrives, then daily checks move the demo clock.
  await page.goto(batchUrl);
  await page.getByRole("button", { name: "Simulate a subcontractor reply" }).click();
  await page.getByText(/is now safe to pay/).first().waitFor();
  await page.waitForTimeout(800);
  await page.getByText("Activity", { exact: true }).scrollIntoViewIfNeeded();
  await shot(page, "10-reply-clears-a-hold", false);
  const daily = page.getByRole("button", { name: "Run daily check now" });
  for (let i = 0; i < 3; i++) {
    await daily.click();
    // The button is disabled while the check runs; wait until it is back.
    await page.waitForTimeout(300);
    await page.waitForFunction(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("Run daily check now"));
      return b instanceof HTMLButtonElement && !b.disabled;
    }, undefined, { timeout: 60_000 });
    await page.waitForLoadState("networkidle");
  }
  await page.goto(`${batchUrl}/drafts`);
  await page.getByRole("navigation", { name: "Subcontractors" }).getByRole("button", { name: /Reminder/ }).first().click();
  await page.waitForTimeout(300);
  await shot(page, "11-reminder-drafted", false);
  await page.goto(`${batchUrl}/audit`);
  await shot(page, "12-audit-log", false);

  // 5. Your own batch: spreadsheets + PDFs, one request per PDF, with progress.
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
  await hideToasts(page, true);
  await page.screenshot({ path: join(OUT, "13-upload-processing.png") });
  console.log("saved 13-upload-processing");
  await page.unrouteAll({ behavior: "ignoreErrors" });

  await page.goto(`${BASE}/about`);
  await shot(page, "14-how-it-works");

  await browser.close();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
