import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __webmcpTools: Map<
      string,
      { execute(input: unknown, context: { signal: AbortSignal }): Promise<string> | string }
    >;
  }
}

test("baseline → reject → revise → apply → verified → export", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "InclusivePatch" })).toBeVisible();
  await expect(page.getByText(/WebMCP unavailable/i)).toBeVisible();

  await page.getByRole("button", { name: /Run baseline proof/i }).click();
  await expect(page.getByText("Keyboard journey failed.")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Issues" }).click();
  await page.getByRole("button", { name: /Run accessibility scan/i }).click();
  await expect(page.getByText("6 open / 0 fixed")).toBeVisible();
  await page.getByRole("button", { name: /Stage all/i }).click();

  await page.getByRole("button", { name: /Proposals/ }).click();
  await expect(page.getByText("6 current / 6 total")).toBeVisible();
  await page.getByRole("button", { name: /Approve low-risk/i }).click();

  const weakProposal = page.locator("article").filter({ hasText: "PROP-006" });
  await weakProposal.getByLabel("Rejection reason").fill("Submit is too vague for the order context");
  await weakProposal.getByRole("button", { name: "Reject" }).click();
  await weakProposal.getByLabel("Revised accessible name").fill("Review and place order");
  await weakProposal.getByRole("button", { name: /Stage revision/i }).click();

  const revision = page.locator("article").filter({ hasText: "PROP-007" });
  await revision.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("button", { name: /Apply 6 approved fixes/i }).click();
  await expect(page.getByText("6 approved remediations applied.")).toBeVisible();

  await page.getByRole("button", { name: "Journey", exact: true }).click();
  await page.getByRole("button", { name: /Run keyboard journey/i }).click();
  await expect(page.getByText("Keyboard journey passed.")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("0 open")).toBeVisible();
  await expect(page.getByText("Journey passed", { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export JSON/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^inclusivepatch-patch-v2\.json$/);

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByText("v2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Journey", exact: true }).click();
  await expect(page.getByText("Journey passed", { exact: true })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Inspector panels" })
    .getByRole("button", { name: /Activity/ })
    .click();
  await expect(page.getByText("Immutable local history")).toBeVisible();
});

test("reset is reproducible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Run accessibility scan/i }).click();
  await expect(page.getByText("6 open / 0 fixed")).toBeVisible();
  await page.getByRole("button", { name: /Reset demo/i }).click();
  await expect(page.getByText("No scan recorded")).toBeVisible();
  await expect(page.getByText("v1")).toBeVisible();
});

test("a running replay can be cancelled without losing normal controls", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Journey", exact: true }).click();
  await page.getByRole("button", { name: /Run keyboard journey/i }).click();
  await page.getByRole("button", { name: /Cancel replay/i }).click();
  await expect(page.getByText("Keyboard journey cancelled.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Run keyboard journey/i })).toBeEnabled();
});

test("WebMCP registration failures remain visible and the human UI remains usable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: { registerTool: () => Promise.reject(new Error("registration denied for test")) },
    });
  });
  await page.goto("/");
  await expect(page.locator(".webmcp-pill")).toContainText("error");
  await expect(page.locator(".webmcp-pill")).toHaveAttribute("title", "registration denied for test");
  await page.getByRole("button", { name: /Run accessibility scan/i }).click();
  await expect(page.getByText(/6 open\s*\/\s*0 fixed/)).toBeVisible();
});

test("WebMCP tools register by phase and update the shared interface", async ({ page }) => {
  await page.addInitScript(() => {
    const registry = new Map<
      string,
      { execute(input: unknown, context: { signal: AbortSignal }): Promise<string> | string }
    >();
    window.__webmcpTools = registry;
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool(
          tool: { name: string; execute(input: unknown, context: { signal: AbortSignal }): Promise<string> | string },
          options?: { signal?: AbortSignal },
        ) {
          registry.set(tool.name, tool);
          options?.signal?.addEventListener(
            "abort",
            () => {
              if (registry.get(tool.name) === tool) registry.delete(tool.name);
            },
            { once: true },
          );
        },
      },
    });
  });

  await page.goto("/");
  await expect(page.locator(".webmcp-pill")).toContainText("available");
  await expect.poll(() => page.evaluate(() => [...window.__webmcpTools.keys()].sort())).toEqual([
    "get_workspace_state",
    "replay_keyboard_journey",
    "scan_current_checkout",
  ]);

  const scanResult = await page.evaluate(async () => {
    const tool = window.__webmcpTools.get("scan_current_checkout")!;
    return JSON.parse(await tool.execute({ scope: "current-fixture" }, { signal: new AbortController().signal }));
  });
  expect(scanResult.ok).toBe(true);
  expect(scanResult.data.openCount).toBe(6);
  await expect(page.getByText("6 open / 0 fixed")).toBeVisible();
  await expect.poll(() => page.evaluate(() => [...window.__webmcpTools.keys()])).toContain("stage_fix");

  const stageResult = await page.evaluate(async () => {
    const tool = window.__webmcpTools.get("stage_fix")!;
    return JSON.parse(
      await tool.execute(
        { issueId: "A11Y-001", optionId: "add_email_label" },
        { signal: new AbortController().signal },
      ),
    );
  });
  expect(stageResult.ok).toBe(true);
  expect(stageResult.data.proposalId).toBe("PROP-001");

  await page.getByRole("button", { name: /Proposals/ }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect.poll(() => page.evaluate(() => [...window.__webmcpTools.keys()])).toContain("apply_approved_fixes");

  const applyResult = await page.evaluate(async () => {
    const tool = window.__webmcpTools.get("apply_approved_fixes")!;
    return JSON.parse(
      await tool.execute({ proposalIds: ["PROP-001"] }, { signal: new AbortController().signal }),
    );
  });
  expect(applyResult.ok).toBe(true);
  expect(applyResult.checkoutVersion).toBe(2);
  await expect(page.getByText("v2")).toBeVisible();
  await expect(page.getByRole("button", { name: /Review remaining issues/i })).toBeVisible();
  await expect.poll(() => page.evaluate(() => [...window.__webmcpTools.keys()])).toEqual(
    expect.arrayContaining(["compare_versions", "undo_last_applied_fix", "export_patch_manifest"]),
  );
});
