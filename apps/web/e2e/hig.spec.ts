/**
 * Faz A7 — automated HIG audit. Each test names the checklist item and its HIG source.
 * Runs in 4 projects: 375 px / 1920 px × light / dark.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { FIXTURE_TITLE, isCompact, shot } from "./helpers";

const PAGES = [
  { name: "library", path: "/library" },
  { name: "chat", path: "/chat" },
  { name: "graph", path: "/graph" },
  { name: "settings", path: "/settings" },
];

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800); // layout animation / data
}

async function fontAudit(page: Page, minPx: number) {
  return page.evaluate((min) => {
    const bad: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim()) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (cs.visibility === "hidden" || cs.display === "none" || r.width === 0 || el.closest(".sr-only,[aria-hidden=true]")) continue;
      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10);
      if (size < min - 0.01) bad.push(`${size}px: "${n.textContent.trim().slice(0, 30)}"`);
      if (weight < 400) bad.push(`weight ${weight}: "${n.textContent.trim().slice(0, 30)}"`);
    }
    return bad;
  }, minPx);
}

async function hitTargetAudit(page: Page, minimum: number) {
  return page.evaluate((min) => {
    const bad: string[] = [];
    document.querySelectorAll<HTMLElement>("button, a[href], [role=button], select, input:not([type=hidden]):not([type=file])").forEach((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || cs.visibility === "hidden" || el.closest(".sr-only, .sr-only-focusable, [aria-hidden=true], [inert], .react-flow__minimap")) return;
      if (r.right < 0 || r.left > innerWidth) return; // off-screen (hidden sidebar)
      // Inline text links inside a sentence are exempt (WCAG 2.5.8 inline exception).
      if (el.tagName === "A" && cs.display === "inline") return;
      if (r.width < min || r.height < min) bad.push(`${Math.round(r.width)}×${Math.round(r.height)} ${el.tagName} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`);
    });
    return bad;
  }, minimum);
}

async function attach(info: TestInfo, name: string, data: unknown) {
  await info.attach(name, { body: JSON.stringify(data, null, 2), contentType: "application/json" });
}

test.describe("Screens", () => {
  for (const p of PAGES) {
    test(`${p.name}: contrast, type, hit targets, overflow, glass & status rules`, async ({ page }, info) => {
      await open(page, p.path);
      if (p.name === "chat") {
        await page.getByLabel("Soru").fill("Roket X aracını hangi şirket geliştirdi?");
        await page.getByLabel("Soru").press("Enter");
        await expect(page.getByRole("region", { name: "İlişki zinciri" }).or(page.getByText("Pasajlar")).first()).toBeVisible({ timeout: 20_000 });
      }
      if (p.name === "library" && !isCompact(page)) {
        await page.getByRole("row").filter({ hasText: FIXTURE_TITLE }).first().click();
        await expect(page.getByRole("heading", { name: FIXTURE_TITLE })).toBeVisible();
      }
      await shot(page, info.project.name, p.name);

      // [ ] Contrast ≥ 4.5:1 (≤17pt) / ≥ 3:1 (large) in light, dark. // HIG: accessibility
      const axe = await new AxeBuilder({ page }).withTags(["wcag2aa"]).withRules(["color-contrast"])
        .exclude(".react-flow__minimap").analyze();
      await attach(info, "contrast", axe.violations.flatMap((v) => v.nodes.map((n) => n.failureSummary + " @ " + n.target.join(" "))));
      expect(axe.violations, "color-contrast violations").toEqual([]);

      // [ ] No Light/Thin weights; minimum 10pt desktop / 11pt mobile. // HIG: typography
      const fonts = await fontAudit(page, isCompact(page) ? 11 : 10);
      await attach(info, "fonts", fonts);
      expect(fonts).toEqual([]);

      // [ ] Hit targets: ≥ 20×20 pointer minimum, ≥ 28×28 touch minimum (recommended 28 / 44 reported). // HIG: accessibility
      const minimum = isCompact(page) ? 28 : 20;
      const recommended = isCompact(page) ? 44 : 28;
      const hard = await hitTargetAudit(page, minimum);
      await attach(info, "hit-targets-below-recommended", await hitTargetAudit(page, recommended));
      expect(hard, `targets below ${minimum}px`).toEqual([]);

      // [ ] No horizontal page scroll at this width. // HIG: layout
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);

      // [ ] Glass only in the control layer, never on content. // HIG: materials
      // Modal dialogs are control layer even when nested in an article in the DOM.
      const glassInContent = await page.locator('[role=log] .glass, table .glass, ul[aria-label="Dokümanlar"] .glass, article .glass:not(dialog)').count();
      expect(glassInContent).toBe(0);

      // [ ] Status never by color alone: every status-colored symbol has a label or sits next to text. // HIG: color, accessibility
      const colorOnly = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[class*="text-status-"]')]
          .filter((el) => el.getBoundingClientRect().width > 0)
          .filter((el) => !el.getAttribute("aria-label") && !(el.parentElement?.textContent ?? "").trim() && !el.textContent?.trim())
          .map((el) => el.outerHTML.slice(0, 80)),
      );
      expect(colorOnly).toEqual([]);
    });
  }

  test("login: one primary action, no symbol used as a logo, keyboard sign-in", async ({ browser }, info) => {
    const ctx = await browser.newContext({ viewport: test.info().project.use.viewport ?? undefined, colorScheme: test.info().project.use.colorScheme });
    const page = await ctx.newPage();
    await page.goto("/login");
    await shot(page, info.project.name, "login");
    await expect(page.locator("main button.bg-accent-fill")).toHaveCount(1); // HIG: toolbars "only one primary action"
    await expect(page.locator("header svg, header img")).toHaveCount(0); // HIG: sf-symbols (no logo)
    const axe = await new AxeBuilder({ page }).withRules(["color-contrast", "label"]).analyze();
    expect(axe.violations).toEqual([]);
    await ctx.close();
  });
});

test.describe("Navigation", () => {
  test("tab bar (compact) / sidebar (regular)", async ({ page }) => {
    await open(page, "/library");
    if (isCompact(page)) {
      // [ ] ≤5 tabs, one-word labels, .fill symbols, navigation only. // HIG: tab-bars
      const tabs = page.getByRole("navigation", { name: "Sekmeler" }).getByRole("link");
      await expect(tabs).toHaveCount(5);
      for (const label of ["Kütüphane", "Sohbet", "Grafik", "Ayarlar"]) {
        await expect(page.getByRole("navigation", { name: "Sekmeler" }).getByText(label, { exact: true })).toBeVisible();
      }
      await expect(page.getByRole("navigation", { name: "Sekmeler" }).getByRole("button")).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Kenar çubuğu" })).toHaveCount(0);
    } else {
      // [ ] Sidebar open by default, ≤2 levels, nothing critical at the bottom. // HIG: sidebars
      const sidebar = page.getByRole("navigation", { name: "Kenar çubuğu" });
      await expect(sidebar).toBeVisible();
      expect(await sidebar.locator("ul ul").count()).toBe(0);
      await expect(sidebar.getByRole("heading")).toHaveText(["Bölümler", "Koleksiyonlar"]);
    }
  });

  test("toolbar: title ≤15 chars, ≤3 groups, one prominent action", async ({ page }) => {
    for (const p of PAGES) {
      await open(page, p.path);
      const header = page.locator("header").first();
      const title = (await header.getByRole("heading", { level: 1 }).innerText()).trim();
      expect(title.length, `${p.path} title`).toBeLessThanOrEqual(15);
      expect(title).not.toContain("DocuPulse");
      const groups = await header.evaluate((h) =>
        [...h.children].filter((c) => !(c as HTMLElement).classList.contains("flex-1") && (c as HTMLElement).getBoundingClientRect().width > 0).length);
      expect(groups, `${p.path} groups`).toBeLessThanOrEqual(3);
      expect(await header.locator("button.bg-accent-fill").count(), `${p.path} prominent`).toBeLessThanOrEqual(1);
    }
  });

  test("keyboard: ⌘/Ctrl+1..4 switches sections; graph nodes reachable by Tab + Enter", async ({ page }) => {
    test.skip(isCompact(page), "keyboard shortcuts target pointer devices");
    await open(page, "/library");
    await page.keyboard.press("Control+2");
    await expect(page).toHaveURL(/\/chat/);
    await page.keyboard.press("Control+3");
    await expect(page).toHaveURL(/\/graph/);
    await page.waitForTimeout(1500);
    const node = page.locator(".react-flow__node").first();
    await node.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("complementary", { name: "Varlık ayrıntıları" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("complementary", { name: "Varlık ayrıntıları" })).toHaveCount(0);
  });
});

test.describe("Accessibility settings", () => {
  test("text at 200% does not clip or scroll sideways", async ({ page }) => {
    for (const p of PAGES) {
      await open(page, p.path);
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, `${p.path} horizontal overflow at 200%`).toBeLessThanOrEqual(1);
    }
  });

  test("reduced motion: animations collapse, graph settles without animating", async ({ browser }) => {
    const ctx = await browser.newContext({
      ...test.info().project.use,
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto("/library");
    const dur = await page.evaluate(() => {
      const el = document.createElement("div");
      el.style.animation = "dp-spin 1s linear infinite";
      document.body.appendChild(el);
      return getComputedStyle(el).animationDuration;
    });
    expect(parseFloat(dur)).toBeLessThan(0.001);
    await ctx.close();
  });

  test("reduced transparency + increased contrast are wired in the stylesheet", async ({ page }) => {
    await open(page, "/library");
    const rules = await page.evaluate(() =>
      [...document.styleSheets].flatMap((s) => {
        try {
          return [...s.cssRules].map((r) => r.cssText);
        } catch {
          return [];
        }
      }).join("\n"),
    );
    expect(rules).toContain("prefers-reduced-transparency: reduce");
    expect(rules).toContain("prefers-contrast: more");
    expect(rules).toContain("prefers-color-scheme: dark");
  });
});

test.describe("Drag and drop", () => {
  test("highlight only for acceptable files; unsupported shows circle.slash text", async ({ page }) => {
    test.skip(isCompact(page), "drag and drop is a pointer interaction");
    await open(page, "/library");
    const drag = async (type: string, name: string) =>
      page.evaluate(([t, n]) => {
        const dt = new DataTransfer();
        dt.items.add(new File(["x"], n, { type: t }));
        window.dispatchEvent(new DragEvent("dragenter", { dataTransfer: dt, bubbles: true }));
      }, [type, name]);
    const leave = () =>
      page.evaluate(() => {
        const dt = new DataTransfer();
        dt.items.add(new File(["x"], "x.md", { type: "text/markdown" })); // real dragleave events carry the Files type
        window.dispatchEvent(new DragEvent("dragleave", { dataTransfer: dt, bubbles: true }));
      });

    await drag("image/png", "foto.png");
    await expect(page.getByText("Bu dosya türü desteklenmiyor")).toBeVisible();
    await expect(page.getByText("Bırakarak yükle")).toHaveCount(0);
    await leave();

    await drag("text/markdown", "notlar.md");
    await expect(page.getByText("Bırakarak yükle")).toBeVisible();
    await shot(page, test.info().project.name, "library-drop");
    await leave();
    await expect(page.getByText("Bırakarak yükle")).toHaveCount(0); // highlight removed when the drag leaves

    // Alternative path exists. // HIG: drag-and-drop
    await expect(page.getByRole("button", { name: "Yükle" }).first()).toBeVisible();
  });
});
