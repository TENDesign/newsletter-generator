import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the newsletter editor and desktop PDF bridge", async () => {
  const [page, preload, main, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("electron/preload.cjs", root), "utf8"),
    readFile(new URL("electron/main.mjs", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(page, /NewsletterPreview/);
  assert.match(page, /generatePdf/);
  assert.match(preload, /pdf:generate/);
  assert.match(main, /renderNewsletterPdf/);
  assert.match(main, /Harbor Press Newsletter Studio/);
  assert.equal(JSON.parse(packageJson).version, "1.0.0");
});

test("keeps database and publishing features out of the local-first app", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.doesNotMatch(page, /\bpublished\b|\bunpublished\b/i);
  assert.doesNotMatch(page, /drizzle|database/i);
});
