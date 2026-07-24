import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { createServer } from "node:http";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PDFDocument } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
let localServer;
const exportPdfArgument = process.argv.find((argument) => argument.startsWith("--export-pdf="));

const dataDirectory = () => path.join(app.getPath("documents"), "Harbor Press Newsletter Studio");
const issuesFile = () => path.join(dataDirectory(), "issues.json");
const backupsDirectory = () => path.join(dataDirectory(), "backups");
const assetsDirectory = () => path.join(dataDirectory(), "assets");

async function ensureDataDirectories() {
  await mkdir(dataDirectory(), { recursive: true });
  await mkdir(backupsDirectory(), { recursive: true });
  await mkdir(path.join(assetsDirectory(), "logos"), { recursive: true });
  await mkdir(path.join(assetsDirectory(), "memorial-images"), { recursive: true });
  await mkdir(path.join(assetsDirectory(), "attachments"), { recursive: true });
}

const extensionForMime = (mime) => ({
  "application/pdf": "pdf",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}[mime] || "bin");

const mimeForExtension = (extension) => ({
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".webp": "image/webp",
}[extension.toLowerCase()] || "application/octet-stream");

const safeName = (value) => String(value || "item").replace(/[^a-z0-9_-]+/gi, "-");

async function storeDataUrl(value, folder, filename) {
  if (typeof value !== "string" || !value.startsWith("data:")) return value || "";
  const match = value.match(/^data:([^;,]+);base64,(.+)$/s);
  if (!match) return value;
  const extension = extensionForMime(match[1]);
  const relativePath = path.join(folder, `${safeName(filename)}.${extension}`);
  await writeFile(path.join(assetsDirectory(), relativePath), Buffer.from(match[2], "base64"));
  return `harborpress-file:${relativePath.split(path.sep).join("/")}`;
}

async function hydrateAsset(value) {
  if (typeof value !== "string" || !value.startsWith("harborpress-file:")) return value || "";
  const relativePath = value.slice("harborpress-file:".length);
  const absolutePath = path.resolve(assetsDirectory(), relativePath);
  if (!absolutePath.startsWith(`${assetsDirectory()}${path.sep}`)) return "";
  try {
    const data = await readFile(absolutePath);
    return `data:${mimeForExtension(path.extname(absolutePath))};base64,${data.toString("base64")}`;
  } catch {
    return "";
  }
}

async function prepareIssuesForDisk(issues) {
  return Promise.all(issues.map(async (issue) => ({
    ...issue,
    logo: await storeDataUrl(issue.logo, "logos", issue.id),
    memorials: await Promise.all((issue.memorials || []).map(async (memorial) => ({
      ...memorial,
      image: await storeDataUrl(memorial.image, "memorial-images", `${issue.id}-${memorial.id}`),
    }))),
    pdfPages: await Promise.all((issue.pdfPages || []).map(async (pdfPage) => ({
      ...pdfPage,
      data: await storeDataUrl(pdfPage.data, "attachments", `${issue.id}-${pdfPage.id}`),
    }))),
  })));
}

async function hydrateIssues(issues) {
  return Promise.all(issues.map(async (issue) => ({
    ...issue,
    logo: await hydrateAsset(issue.logo),
    memorials: await Promise.all((issue.memorials || []).map(async (memorial) => ({
      ...memorial,
      image: await hydrateAsset(memorial.image),
    }))),
    pdfPages: await Promise.all((issue.pdfPages || []).map(async (pdfPage) => ({
      ...pdfPage,
      data: await hydrateAsset(pdfPage.data),
    }))),
  })));
}

async function loadIssues() {
  await ensureDataDirectories();
  try {
    return hydrateIssues(JSON.parse(await readFile(issuesFile(), "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function saveIssues(issues) {
  await ensureDataDirectories();
  const diskIssues = await prepareIssuesForDisk(issues);
  const target = issuesFile();
  const temporary = `${target}.tmp`;
  try {
    await stat(target);
    const day = new Date().toISOString().slice(0, 10);
    await copyFile(target, path.join(backupsDirectory(), `issues-${day}.json`));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await writeFile(temporary, `${JSON.stringify(diskIssues, null, 2)}\n`, "utf8");
  await rename(temporary, target);
  return true;
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function startProductionServer() {
  const clientRoot = path.join(projectRoot, "dist", "client");
  const workerModule = await import(pathToFileURL(path.join(projectRoot, "dist", "server", "index.js")).href);
  const assetFetcher = {
    async fetch(request) {
      const requestUrl = new URL(request.url);
      const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
      const assetPath = path.resolve(clientRoot, relativePath);
      if (!assetPath.startsWith(`${clientRoot}${path.sep}`)) return new Response("Not found", { status: 404 });
      try {
        const body = await readFile(assetPath);
        return new Response(body, { headers: { "Content-Type": mimeTypes[path.extname(assetPath)] || "application/octet-stream" } });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    },
  };

  localServer = createServer(async (request, response) => {
    try {
      const origin = `http://127.0.0.1:${localServer.address().port}`;
      const url = new URL(request.url || "/", origin);
      if (url.pathname.startsWith("/assets/") || /\.(?:css|gif|ico|jpe?g|js|json|mjs|png|svg|webp|woff2?)$/i.test(url.pathname)) {
        const assetResponse = await assetFetcher.fetch(new Request(url));
        if (assetResponse.ok) {
          response.statusCode = assetResponse.status;
          assetResponse.headers.forEach((value, name) => response.setHeader(name, value));
          response.end(Buffer.from(await assetResponse.arrayBuffer()));
          return;
        }
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) value.forEach((entry) => headers.append(name, entry));
        else if (value !== undefined) headers.set(name, value);
      }
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const method = request.method || "GET";
      const body = method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks);
      const executionContext = {
        waitUntil(promise) {
          Promise.resolve(promise).catch((error) => console.error("Background task failed", error));
        },
        passThroughOnException() {},
      };
      const result = await workerModule.default.fetch(new Request(url, { method, headers, body }), { ASSETS: assetFetcher }, executionContext);
      response.statusCode = result.status;
      result.headers.forEach((value, name) => response.setHeader(name, value));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch (error) {
      response.statusCode = 500;
      response.end("Unable to load Harbor Press.");
      console.error(error);
    }
  });

  await new Promise((resolve, reject) => {
    localServer.once("error", reject);
    localServer.listen(0, "127.0.0.1", resolve);
  });
  return `http://127.0.0.1:${localServer.address().port}`;
}

async function createWindow() {
  const window = new BrowserWindow({
    show: !exportPdfArgument,
    width: 1500,
    height: 960,
    minWidth: 1050,
    minHeight: 720,
    title: "Harbor Press Newsletter Studio",
    backgroundColor: "#edf0ef",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const rendererUrl = app.isPackaged ? await startProductionServer() : "http://localhost:3000";
  await window.loadURL(rendererUrl);
  return window;
}

async function renderNewsletterPdf(webContents) {
  const measurement = await webContents.executeJavaScript(`(async () => {
    document.documentElement.classList.remove("pdf-export-attachments");
    document.documentElement.classList.add("pdf-export-main");
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const page = document.querySelector(".newsletter-page:not(.attachment-page)");
    const rect = page?.getBoundingClientRect();
    return {
      x: Math.floor(rect?.x || 0),
      y: Math.floor(rect?.y || 0),
      width: Math.ceil(rect?.width || 816),
      height: Math.ceil(rect?.height || 1056),
      attachmentCount: document.querySelectorAll(".attachment-page").length,
    };
  })()`);

  webContents.debugger.attach("1.3");
  let mainPng;
  try {
    const screenshot = await webContents.debugger.sendCommand("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
      clip: {
        x: measurement.x,
        y: measurement.y,
        width: measurement.width,
        height: measurement.height,
        scale: 1,
      },
    });
    mainPng = Buffer.from(screenshot.data, "base64");
  } finally {
    webContents.debugger.detach();
  }

  let attachmentPdf = null;
  if (measurement.attachmentCount > 0) {
    await webContents.executeJavaScript(`(async () => {
      document.documentElement.classList.remove("pdf-export-main");
      document.documentElement.classList.add("pdf-export-attachments");
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    })()`);
    attachmentPdf = await webContents.printToPDF({
      pageSize: "Letter",
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
  }

  await webContents.executeJavaScript(
    `document.documentElement.classList.remove("pdf-export-main", "pdf-export-attachments")`,
  );

  const output = await PDFDocument.create();
  const embeddedMain = await output.embedPng(mainPng);
  const mainWidth = 612;
  const mainHeight = mainWidth * measurement.height / measurement.width;
  const mainPage = output.addPage([mainWidth, mainHeight]);
  mainPage.drawImage(embeddedMain, { x: 0, y: 0, width: mainWidth, height: mainHeight });
  if (attachmentPdf) {
    const attachmentDocument = await PDFDocument.load(attachmentPdf);
    const attachmentPages = await output.copyPages(attachmentDocument, attachmentDocument.getPageIndices());
    attachmentPages.forEach((page) => output.addPage(page));
  }
  return Buffer.from(await output.save());
}

app.whenReady().then(async () => {
  const importArgument = process.argv.find((argument) => argument.startsWith("--import-file="));
  if (importArgument) {
    const importPath = importArgument.slice("--import-file=".length);
    await saveIssues(JSON.parse(await readFile(importPath, "utf8")));
  }
  ipcMain.handle("storage:load-issues", loadIssues);
  ipcMain.handle("storage:save-issues", (_event, issues) => saveIssues(issues));
  ipcMain.handle("storage:get-directory", async () => {
    await ensureDataDirectories();
    return dataDirectory();
  });
  ipcMain.handle("storage:open-directory", async () => {
    await ensureDataDirectories();
    return shell.openPath(dataDirectory());
  });
  ipcMain.handle("pdf:generate", async (event, suggestedName) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error("The newsletter window is unavailable.");
    const safeFilename = String(suggestedName || "newsletter")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
    const result = await dialog.showSaveDialog(window, {
      title: "Save newsletter PDF",
      defaultPath: path.join(app.getPath("documents"), `${safeFilename || "newsletter"}.pdf`),
      filters: [{ name: "PDF document", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const pdf = await renderNewsletterPdf(event.sender);
    await writeFile(result.filePath, pdf);
    return { canceled: false, filePath: result.filePath };
  });
  const window = await createWindow();
  if (exportPdfArgument) {
    const outputPath = path.resolve(exportPdfArgument.slice("--export-pdf=".length));
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const ready = await window.webContents.executeJavaScript(
        "Boolean(document.querySelector('.newsletter-page')) && !document.querySelector('.attachment-loading')",
      );
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const pdf = await renderNewsletterPdf(window.webContents);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, pdf);
    app.quit();
    return;
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  localServer?.close();
});
