const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");
const driverStep = require("./driver.js");
const url = process.argv[2] || "http://localhost:8790/index.html";
const shots = path.join(__dirname, "shots");
fs.mkdirSync(shots, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function playOut(page, label, errors, maxSteps) {
  const counts = {};
  let idle = 0;
  for (let i = 0; i < maxSteps; i++) {
    const r = await page.evaluate(driverStep, {});
    const k = r.split(":")[0];
    counts[k] = (counts[k] || 0) + 1;
    if (r === "over") return counts;
    if (k === "cast" && Math.random() < 0.02) console.log("  " + label + " " + r);
    if (r.indexOf("stuck") === 0) errors.push(label + " " + r);
    if (r === "wait") { idle++; await sleep(60); } else { idle = 0; await sleep(30); }
    if (idle > 1500) { errors.push(label + " idle too long: " + (await page.$eval(".banner", e => e.textContent).catch(() => "?"))); return counts; }
  }
  errors.push(label + " did not finish");
  return counts;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.setViewport({ width: 1300, height: 900 });
  await page.goto(url, { waitUntil: "networkidle2" });
  await sleep(500);
  await page.screenshot({ path: path.join(shots, "1-home.png"), fullPage: true });
  await page.setViewport({ width: 390, height: 844 });
  await sleep(300);
  await page.screenshot({ path: path.join(shots, "1-home-phone.png"), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log("home phone horizontal overflow px:", overflow);
  await page.setViewport({ width: 1300, height: 900 });
  await page.click('[data-act="rules"]');
  await sleep(200);
  await page.screenshot({ path: path.join(shots, "2-rules.png") });
  await page.keyboard.press("Escape");
  await sleep(100);
  console.log("rules closed:", await page.$eval("#rules", e => e.hidden));

  // Practice game
  await page.$eval("#my-name", e => { e.value = "Tester"; });
  await page.select("#pr-bots", "3");
  await page.select("#pr-level", "hard");
  await page.select("#pr-timer", "30");
  await page.click('[data-act="practice-start"]');
  await page.evaluate(() => window.__inkmalice.setBotSpeed(0.04));
  await sleep(300);
  // Hint check on first human compose turn
  let hinted = false;
  for (let i = 0; i < 400 && !hinted; i++) {
    const has = await page.$('[data-act="hint"]');
    if (has) {
      await page.click('[data-act="hint"]');
      await sleep(400);
      const txt = await page.$eval(".coach", e => e.textContent).catch(() => "none");
      console.log("hint:", txt.slice(0, 120));
      await page.keyboard.type("q");
      await sleep(100);
      await page.screenshot({ path: path.join(shots, "3-practice-compose.png"), fullPage: true });
      await page.setViewport({ width: 390, height: 844 });
      await sleep(300);
      await page.screenshot({ path: path.join(shots, "3-practice-phone.png"), fullPage: true });
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      console.log("game phone horizontal overflow px:", ov);
      await page.setViewport({ width: 1300, height: 900 });
      hinted = true;
    } else {
      const r = await page.evaluate(driverStep, {});
      await sleep(r === "wait" ? 60 : 30);
    }
  }
  const c1 = await playOut(page, "practice", errors, 20000);
  console.log("practice counts", JSON.stringify(c1));
  await page.screenshot({ path: path.join(shots, "4-practice-over.png"), fullPage: true });
  const coachSeen = await page.evaluate(() => document.querySelectorAll(".chron li").length);
  console.log("chronicle entries:", coachSeen);

  // Timeout check: idle on an opening cast
  await page.click('[data-act="leave"]');
  await sleep(200);
  await page.select("#pr-bots", "1");
  await page.select("#pr-timer", "30");
  await page.click('[data-act="practice-start"]');
  await page.evaluate(() => window.__inkmalice.setBotSpeed(0.04));
  for (let i = 0; i < 600; i++) {
    const st = await page.evaluate(() => { const p = window.__inkmalice.peek(); return p.S.turn.seat + ":" + p.S.turn.phase; });
    if (st === "0:cast") break;
    const r = await page.evaluate(driverStep, {});
    await sleep(r === "wait" ? 60 : 30);
  }
  const before = await page.evaluate(() => window.__inkmalice.peek().S.turn);
  console.log("idling on", before.phase, "for seat", before.seat);
  await sleep(32500);
  const after = await page.evaluate(() => { const p = window.__inkmalice.peek(); return { phase: p.S.turn.phase, seat: p.S.turn.seat, log: p.S.log[p.S.log.length - 1].txt }; });
  console.log("after timeout:", JSON.stringify(after));
  await page.screenshot({ path: path.join(shots, "5-after-timeout.png"), fullPage: true });

  // Pass and play
  await page.click('[data-act="leave-ask"]');
  await page.click('[data-act="leave-ask"]');
  await sleep(200);
  await page.click('[data-act="hs-add"]');
  await page.$$eval("[data-hs]", els => { els[0].value = "Ada"; els[1].value = "Bram"; els[2].value = "Cleo"; });
  await page.select("#hs-timer", "0");
  await page.click('[data-act="hotseat-start"]');
  await sleep(300);
  await page.screenshot({ path: path.join(shots, "6-hotseat-cover.png") });
  const c2 = await playOut(page, "hotseat", errors, 20000);
  console.log("hotseat counts", JSON.stringify(c2));
  await page.screenshot({ path: path.join(shots, "7-hotseat-over.png"), fullPage: true });
  console.log("ERRORS:", errors.length ? errors.join("\n") : "none");
  await browser.close();
})();
