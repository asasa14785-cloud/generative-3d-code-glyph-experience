// Playwright capture: node research/qa/capture.mjs "t1,t2,..." [quality=0] [outPrefix=shot]
import { chromium } from "playwright";
import path from "path"; import fs from "fs";
const times = (process.argv[2] || "1").split(",").map(Number);
const q = process.argv[3] ?? "0"; const prefix = process.argv[4] ?? "shot";
const file = "file://" + path.resolve("dist/index.html") + "?q=" + q;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--use-gl=angle", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on("console", (m) => { logs.push(`[${m.type()}] ${m.text()}`); });
page.on("pageerror", (e) => logs.push("[pageerror] " + e.message));
await page.goto(file);
try { await page.waitForFunction(() => window.__gardenReady === true, null, { timeout: 240000 }); } catch (e) { console.log("NOT READY", e.message); }
console.log("ready; logs so far:\n" + logs.slice(0, 20).join("\n"));
fs.mkdirSync("research/screenshots", { recursive: true });
for (const t of times) {
  const t0 = Date.now();
  await page.evaluate((t) => { window.__garden.engine.resetHistory(); window.__garden.renderAt(t); window.__garden.renderAt(t); }, t);
  const data = await page.evaluate(() => document.getElementById("film").toDataURL("image/png"));
  fs.writeFileSync(`research/screenshots/${prefix}_${String(t).replace(".", "p").padStart(5, "0")}.png`, Buffer.from(data.split(",")[1], "base64"));
  console.log("t=" + t, "ms=" + (Date.now() - t0));
}
console.log(logs.filter((l) => !l.includes("GPU stall")).slice(0, 30).join("\n"));
await browser.close();
