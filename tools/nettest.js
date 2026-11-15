const puppeteer = require("puppeteer-core");
const path = require("path");
const driverStep = require("./driver.js");
const mock = require("./mockclaude.js");
const mode = process.argv[2] || "peer";
let url = "http://localhost:8790/index.html";
if (mode === "cloud") url = "http://localhost:8790/artifact.html";
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function playBoth(pages, errors, maxSteps) {
  const counts = {};
  let idle = 0;
  for (let i = 0; i < maxSteps; i++) {
    let moved = false;
    let overs = 0;
    for (const [name, page] of pages) {
      const r = await page.evaluate(driverStep, {});
      const k = name + ":" + r.split(":")[0];
      counts[k] = (counts[k] || 0) + 1;
      if (r === "over") overs++;
      else if (r !== "wait") moved = true;
      if (r.indexOf("stuck") === 0) errors.push(name + " " + r);
    }
    if (overs === pages.length) return counts;
    if (!moved) { idle++; await sleep(80); } else { idle = 0; await sleep(120); }
    if (idle > 1200) {
      for (const [name, page] of pages) errors.push(name + " idle: " + (await page.$eval(".banner", e => e.textContent).catch(() => "no banner")));
      return counts;
    }
  }
  errors.push("did not finish");
  return counts;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
  const host = await (await browser.createBrowserContext()).newPage();
  const guest = await (await browser.createBrowserContext()).newPage();
  const errors = [];
  for (const [name, p] of [["host", host], ["guest", guest]]) {
    await p.setViewport({ width: 1300, height: 900 });
    p.on("pageerror", e => errors.push(name + " pageerror: " + e.message));
    p.on("console", m => { if (m.type() === "error") errors.push(name + " console: " + m.text()); });
    p.on("requestfailed", r => errors.push(name + " requestfailed: " + r.url()));
    p.on("response", r => { if (r.status() >= 400 && !r.url().endsWith("favicon.ico")) errors.push(name + " http " + r.status() + " " + r.url()); });
  }
  if (mode === "cloud") {
    await mock.wire(host, "u_host111");
    await mock.wire(guest, "u_friend22");
  }
  await host.goto(url, { waitUntil: "networkidle2" });
  await guest.goto(url, { waitUntil: "networkidle2" });
  await sleep(600);
  console.log("host online card:", (await host.$eval("#online-card", e => e.innerText)).replace(/\s+/g, " ").slice(0, 140));
  await host.$eval("#my-name", e => { e.value = "Hostess"; });
  await host.click('[data-act="online-create"]');
  await host.waitForSelector(".code", { timeout: 20000 });
  const code = await host.$eval(".code", e => e.textContent);
  console.log("room code", code);
  await guest.$eval("#my-name", e => { e.value = "Friend"; });
  await guest.$eval("#on-code", (e, c) => { e.value = c; }, code);
  await guest.click('[data-act="online-join"]');
  await guest.waitForSelector(".seats", { timeout: 25000 });
  await host.waitForFunction(() => document.querySelectorAll(".seats li").length === 2, { timeout: 20000 });
  console.log("guest lobby:", (await guest.$eval(".seats", e => e.innerText)).replace(/\s+/g, " "));
  await host.select("#lb-level", "normal");
  await host.click('[data-act="add-bot"]');
  await sleep(200);
  await host.select("#lb-timer", "30");
  await sleep(300);
  await host.screenshot({ path: path.join(__dirname, "shots", "8-" + mode + "-lobby-host.png") });
  await host.click('[data-act="start"]');
  await host.evaluate(() => window.__inkmalice.setBotSpeed(0.04));
  await guest.waitForSelector(".table", { timeout: 20000 });
  const g0 = await guest.evaluate(() => { const p = window.__inkmalice.peek(); return { me: p.me, n: p.S.players.length, timer: p.S.settings.timer }; });
  console.log("guest sees game:", JSON.stringify(g0));
  let counts = await playBoth([["host", host], ["guest", guest]], errors, 2600);
  console.log("round 1 counts", JSON.stringify(counts));
  await guest.screenshot({ path: path.join(__dirname, "shots", "9-" + mode + "-guest-over.png"), fullPage: true });
  const same = await Promise.all([host, guest].map(p => p.evaluate(() => { const s = window.__inkmalice.peek().S; return s.seq + "/" + s.winner + "/" + s.log.length; })));
  console.log("final state host vs guest:", same.join(" | "));
  if (mode === "cloud") {
    await host.click('[data-act="again"]');
    await sleep(800);
    await host.evaluate(() => window.__inkmalice.setBotSpeed(0.04));
    for (let i = 0; i < 25; i++) {
      const p = await host.evaluate(driverStep, {});
      await guest.evaluate(driverStep, {});
      await sleep(150);
    }
    const before = await host.evaluate(() => window.__inkmalice.peek().S.seq);
    mock.forget(host);
    await host.reload({ waitUntil: "networkidle2" });
    await sleep(900);
    const resumeBtn = await host.$('[data-act="resume"]');
    console.log("resume button after host reload:", !!resumeBtn);
    if (resumeBtn) {
      await resumeBtn.click();
      await host.waitForSelector(".table", { timeout: 10000 });
      await host.evaluate(() => window.__inkmalice.setBotSpeed(0.04));
      const after = await host.evaluate(() => window.__inkmalice.peek().S.seq);
      console.log("seq before reload", before, "after resume", after);
      counts = await playBoth([["host", host], ["guest", guest]], errors, 2600);
      console.log("round 2 counts", JSON.stringify(counts));
    }
    const docs = mock.dump();
    console.log("store docs:", docs.join(", "));
  } else {
    await host.click('[data-act="again"]');
    await guest.waitForFunction(() => window.__inkmalice.peek().S.status === "playing", { timeout: 10000 });
    console.log("play again reached guest");
  }
  console.log("ERRORS:", errors.length ? errors.join("\n") : "none");
  await browser.close();
})();
