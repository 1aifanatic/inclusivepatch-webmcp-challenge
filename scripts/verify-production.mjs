import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const defaultUrl = "https://inclusivepatch.aiconic-innovations.workers.dev";
const url = new URL(process.argv[2] ?? process.env.INCLUSIVEPATCH_PRODUCTION_URL ?? defaultUrl);
const screenshotPath = ".qa/browser/production-verified.png";

await mkdir(".qa/browser", { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  const response = await page.goto(url.href, { waitUntil: "networkidle" });
  if (!response || response.status() !== 200) {
    throw new Error(`Expected HTTP 200, received ${response?.status() ?? "no response"}.`);
  }

  const expectedHeaders = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
    "cross-origin-opener-policy": "same-origin",
  };
  const headers = response.headers();
  for (const [name, expected] of Object.entries(expectedHeaders)) {
    if (headers[name] !== expected) throw new Error(`Invalid ${name}: ${headers[name] ?? "missing"}.`);
  }
  if (!headers["permissions-policy"]?.includes("camera=()")) {
    throw new Error("Restrictive Permissions-Policy was not served.");
  }
  if (!headers["content-security-policy"]?.includes("default-src 'self'")) {
    throw new Error("Restrictive Content-Security-Policy was not served.");
  }

  await page.getByRole("heading", { name: "InclusivePatch" }).waitFor();
  if ((await page.locator("body").innerText()).trim().length < 500) {
    throw new Error("Production page content is unexpectedly sparse.");
  }

  await page.getByRole("button", { name: /Run baseline proof/i }).click();
  await page.getByText("Keyboard journey failed.").waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Issues", exact: true }).click();
  await page.getByRole("button", { name: /Run accessibility scan/i }).click();
  await page.getByText(/6 open\s*\/\s*0 fixed/).waitFor();
  await page.getByRole("button", { name: /Stage all/i }).click();
  await page.getByRole("button", { name: /Proposals/ }).click();
  await page.getByRole("button", { name: /Approve low-risk/i }).click();

  const rejectedProposal = page.locator("article").filter({ hasText: "PROP-006" });
  await rejectedProposal.getByLabel("Rejection reason").fill("Submit is too vague for the order context");
  await rejectedProposal.getByRole("button", { name: "Reject", exact: true }).click();
  await rejectedProposal.getByLabel("Revised accessible name").fill("Review and place order");
  await rejectedProposal.getByRole("button", { name: /Stage revision/i }).click();
  await page
    .locator("article")
    .filter({ hasText: "PROP-007" })
    .getByRole("button", { name: "Approve", exact: true })
    .click();
  await page.getByRole("button", { name: /Apply 6 approved fixes/i }).click();
  await page.getByText("6 approved remediations applied.").waitFor();

  await page.getByRole("button", { name: "Journey", exact: true }).click();
  await page.getByLabel("Reduced motion").check();
  await page.getByRole("button", { name: /Run keyboard journey/i }).click();
  await page.getByText("Keyboard journey passed.").waitFor({ timeout: 10_000 });
  await page.getByText("0 open", { exact: true }).waitFor();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export JSON/i }).click();
  const download = await downloadPromise;
  if (download.suggestedFilename() !== "inclusivepatch-patch-v2.json") {
    throw new Error(`Unexpected manifest filename: ${download.suggestedFilename()}.`);
  }
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("Downloaded manifest was not persisted by Playwright.");
  const manifest = JSON.parse(await readFile(downloadPath, "utf8"));
  if (
    manifest.product !== "InclusivePatch" ||
    manifest.appliedPatches?.length !== 6 ||
    manifest.rejectedProposals?.length !== 1 ||
    manifest.journey?.status !== "passed"
  ) {
    throw new Error("Downloaded manifest did not contain the complete verified audit record.");
  }

  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("v2", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Journey", exact: true }).click();
  await page.getByText("Journey passed", { exact: true }).waitFor();
  await page.screenshot({ path: screenshotPath, fullPage: false });

  await page.getByRole("button", { name: /Undo latest/i }).click();
  await page.getByText("Latest remediation batch reversed; verification invalidated.").waitFor();
  await page.getByText("v3", { exact: true }).waitFor();
  await page.getByText("6 open", { exact: true }).waitFor();

  await page.getByRole("button", { name: /Reset demo/i }).click();
  await page.getByRole("button", { name: "Issues", exact: true }).click();
  await page.getByText("No scan recorded").waitFor();
  await page.getByText("v1", { exact: true }).waitFor();

  const spaUrl = new URL("/submission-smoke", url);
  const spaResponse = await page.goto(spaUrl.href, { waitUntil: "networkidle" });
  if (!spaResponse || spaResponse.status() !== 200) {
    throw new Error(`SPA fallback returned ${spaResponse?.status() ?? "no response"}.`);
  }
  await page.getByRole("heading", { name: "InclusivePatch" }).waitFor();

  if (consoleErrors.length || pageErrors.length) {
    throw new Error(`Browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`);
  }

  console.log(
    JSON.stringify(
      {
        url: url.href,
        status: response.status(),
        title: await page.title(),
        securityHeaders: expectedHeaders,
        baselineFailure: true,
        sixIssueScan: true,
        humanRejectionAndRevision: true,
        appliedCount: 6,
        verifiedJourney: true,
        manifestVerified: true,
        persistenceAfterReload: true,
        undoVerified: true,
        resetReproducible: true,
        spaFallback: true,
        consoleErrors,
        pageErrors,
        screenshotPath,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
