// Dependency-free Chromium smoke checks. Uses an isolated, signed-out browser profile.
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const base = process.env.VIEWER_URL || "http://127.0.0.1:3000";
const executable = process.env.CHROME_BIN || ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
assert.ok(executable, "Set CHROME_BIN to a Chromium browser executable");
const temp = join(process.env.LOCALAPPDATA || process.cwd(), "Temp", "opencode");
await mkdir(temp, { recursive: true });
const output = await mkdtemp(join(temp, "netix-viewer-"));
const browser = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${join(output, "profile")}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const endpoint = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Browser launch timeout")), 20000);
  browser.once("error", reject);
  browser.stderr.on("data", data => { const match = data.toString().match(/DevTools listening on (ws:\/\/\S+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
});
const socket = new WebSocket(endpoint);
await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
let sequence = 0;
let sessionId;
const pending = new Map();
const errors = [];
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const p = pending.get(message.id);
    if (!p) return;
    pending.delete(message.id);
    clearTimeout(p.timer);
    if (message.error) p.reject(new Error(message.error.message));
    else p.resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
});
const send = (method, params = {}, target = sessionId) => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timeout`)); }, 45000);
  pending.set(id, { resolve, reject, timer });
  socket.send(JSON.stringify({ id, method, params, ...(target ? { sessionId: target } : {}) }));
});
const evaluate = async expression => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const wait = condition => evaluate(`(async()=>{const end=Date.now()+20000;while(!(${condition})){if(Date.now()>end)throw new Error('Condition timeout: '+${JSON.stringify(condition)});await new Promise(r=>setTimeout(r,50))}return true})()`);
const navigate = async (route, selector) => {
  await send("Page.navigate", { url: `${base}${route}` });
  await wait(`location.pathname===${JSON.stringify(route.split("?")[0])}&&document.readyState==='complete'&&document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect().width>0&&document.querySelector('h1')?.getBoundingClientRect().width>0`);
  await evaluate("document.fonts.ready.then(()=>true)");
  await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
};
const viewport = async width => { await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false }); await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))"); };
const screenshot = async name => { const { data } = await send("Page.captureScreenshot", { format: "png" }); await writeFile(join(output, name), Buffer.from(data, "base64")); };
const results = [];
try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" }, null);
  ({ sessionId } = await send("Target.attachToTarget", { targetId, flatten: true }, null));
  await send("Page.enable"); await send("Runtime.enable");
  await navigate("/", ".cinema-hero");
  await wait("Object.keys(document.querySelector('.content-shelf')).some(k=>k.startsWith('__reactProps'))");
  const fixture = await evaluate(`(()=>{const row=document.querySelector('.content-shelf');const path=img=>{const u=new URL(img.src,location.href);return (u.searchParams.get('url')||u.pathname).replace(/^.*\\/api\\/tmdb\\/image\\/(?:w\\d+|original)/,'')};return {id:row.querySelector('a').getAttribute('href').split('/watch/')[1].split('?')[0],title:row.querySelector('h3').textContent,type:'movie',poster_path:path(row.querySelector('img')),backdrop_path:path(document.querySelector('.cinema-hero img')),addedAt:Date.now(),watchedAt:Date.now(),progress:65}})()`);
  await evaluate(`localStorage.setItem('streaming_history',JSON.stringify([${JSON.stringify(fixture)}]));localStorage.setItem('streaming_watchlist',JSON.stringify([${JSON.stringify(fixture)}]));true`);
  await navigate("/", ".content-shelf--landscape");
  await wait("Object.keys(document.querySelector('.content-shelf--ranked')).some(k=>k.startsWith('__reactProps'))");
  for (const width of [390, 768, 1024, 1280, 1920]) {
    await viewport(width);
    const metrics = await evaluate(`(()=>{const rows=[...document.querySelectorAll('section.content-row')];return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,rows:rows.length,uniform:rows.every(row=>{const widths=[...row.querySelectorAll('.catalog-artwork')].map(p=>p.getBoundingClientRect().width);return Math.max(...widths)-Math.min(...widths)<1}),arrows:rows.every(row=>[...row.querySelectorAll('.shelf-arrow')].every(b=>{const r=b.getBoundingClientRect(),s=b.querySelector('svg').getBoundingClientRect();return !r.width||Math.abs(r.x+r.width/2-s.x-s.width/2)<1&&Math.abs(r.y+r.height/2-s.y-s.height/2)<1&&r.bottom<=row.querySelector('.catalog-artwork').getBoundingClientRect().top+1}))}})()`);
    assert.equal(metrics.overflow, false); assert.equal(metrics.uniform, true); assert.equal(metrics.arrows, true);
    results.push({ check: "home-layout", ...metrics });
    if (width === 390 || width === 1280) await screenshot(`home-${width}.png`);
  }
  await viewport(1280);
  const shelf = await evaluate(`(()=>{const s=document.querySelector('.content-shelf--ranked');s.scrollIntoView({block:'center',behavior:'instant'});s.style.scrollSnapType='none';s.scrollLeft=0;const r=s.getBoundingClientRect();return {x:r.x+380,y:r.y+90,id:s.id}})()`);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: shelf.x, y: shelf.y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: shelf.x, y: shelf.y, button: "left", buttons: 1, clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: shelf.x - 200, y: shelf.y, button: "left", buttons: 1 });
  const dragging = await evaluate(`({left:document.getElementById(${JSON.stringify(shelf.id)}).scrollLeft,active:document.getElementById(${JSON.stringify(shelf.id)}).classList.contains('is-dragging')})`);
  assert.ok(dragging.left >= 150); assert.equal(dragging.active, true);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: shelf.x - 200, y: shelf.y, button: "left", buttons: 0, clickCount: 1 });
  await wait("!document.querySelector('.is-dragging')");
  assert.equal(await evaluate("location.pathname"), "/");
  results.push({ check: "trusted-mouse-drag", passed: true });
  await evaluate("document.querySelector('.header-search input').focus()");
  await send("Input.insertText", { text: fixture.title.slice(0, 12) });
  await wait("document.querySelector('.search-suggestions [role=option]')");
  const suggestedHref = await evaluate("document.querySelector('.search-suggestions [role=option] a').getAttribute('href')");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowDown", code: "ArrowDown" });
  await wait("document.querySelector('.search-suggestions [aria-selected=true]')");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await wait("location.pathname.startsWith('/watch/')&&document.querySelector('.watch-player iframe')");
  assert.equal(await evaluate("location.pathname"), suggestedHref.split('?')[0]);
  results.push({ check: "autocomplete-keyboard-navigation", passed: true });
  for (const width of [390, 1280]) {
    await viewport(width);
    for (const [route, selector] of [["/browse", ".catalog-grid"], ["/browse?view=list", ".glass-card"], ["/profile?tab=list", ".profile-content"], ["/profile?tab=watchlist", ".profile-content"], ["/profile?tab=settings", ".profile-content"], ["/login", ".auth-card"], ["/register", ".auth-card"], ["/trending", ".catalog-grid"], ["/network", ".network-grid"], ["/network/netflix", ".catalog-grid"], ["/search", ".catalog-grid"], ["/faq", ".legal-page"], ["/terms", ".legal-page"], ["/privacy", ".legal-page"]]) {
      await navigate(route, selector);
      const metrics = await evaluate("({heading:document.querySelector('h1')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth,error:document.body.innerText.includes('Application error')})");
      assert.equal(metrics.overflow, false, JSON.stringify({ route, width, metrics })); assert.equal(metrics.error, false, route);
      results.push({ check: "page-layout", route, width, ...metrics });
    }
  }
  await navigate("/browse", ".catalog-grid");
  await evaluate("document.querySelector('[aria-controls=advanced-filters]').click()");
  await wait("document.querySelector('#advanced-filters')");
  await evaluate("[...document.querySelectorAll('#advanced-filters button')].find(b=>b.textContent==='Terbaru').click()");
  await wait("location.search.includes('sort=terbaru')&&document.querySelector('#advanced-filters button[aria-pressed=true]')");
  assert.ok(await evaluate("!!document.querySelector('#advanced-filters')"));
  await evaluate("document.querySelector('[aria-label=\"Tampilan daftar\"]').click()");
  await wait("location.search.includes('view=list')&&!!document.querySelector('.glass-card')");
  assert.ok(await evaluate("location.search.includes('sort=terbaru')"));
  results.push({ check: "filters-preserve-sort-and-view", passed: true });
  await navigate("/profile?tab=history", ".profile-content");
  await evaluate("[...document.querySelectorAll('aside button')].find(b=>b.textContent.includes('Daftar Saya')).click()");
  await wait("location.search==='?tab=list'&&document.querySelector('h1').textContent==='Daftar Saya'");
  results.push({ check: "profile-tab-navigation", passed: true });
  await navigate("/", ".content-shelf--ranked");
  await evaluate("document.querySelector('.content-shelf--ranked').querySelector('a').click()");
  await wait("location.pathname.startsWith('/watch/')&&!!document.querySelector('.watch-player')");
  for (const width of [390, 1280]) {
    await viewport(width);
    assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
    await screenshot(`watch-${width}.png`);
  }
  results.push({ check: "poster-opens-player", passed: true });
  await wait("document.querySelector('.watch-player iframe')");
  const movieRoute = await evaluate("location.pathname");
  await evaluate("(()=>{const frame=document.querySelector('.watch-player iframe');window.dispatchEvent(new MessageEvent('message',{source:window,origin:new URL(frame.src).origin,data:{type:'MEDIA_DATA',data:{currentTime:120,duration:1000}}}));return true})()");
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('streaming_history')).find(item=>item.id===${JSON.stringify(fixture.id)}).position`), undefined);
  await evaluate("(()=>{const frame=document.querySelector('.watch-player iframe');window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,origin:new URL(frame.src).origin,data:{type:'MEDIA_DATA',data:{currentTime:120,duration:1000}}}));return true})()");
  await wait(`JSON.parse(localStorage.getItem('streaming_history')).find(item=>item.id===${JSON.stringify(fixture.id)}).position===120`);
  await navigate(movieRoute, ".resume-notice");
  const vidlinkHref = await evaluate("document.querySelector('.resume-notice a')?.getAttribute('href')");
  if (vidlinkHref) await navigate(vidlinkHref, ".watch-player iframe");
  await wait("new URL(document.querySelector('.watch-player iframe').src).searchParams.get('startAt')==='120'");
  results.push({ check: "simulated-provider-progress-and-resume-url", passed: true });
  await wait("document.querySelector('.watch-actions button[aria-pressed]')");
  await evaluate("document.querySelector('.watch-actions button[aria-pressed]').click()");
  await wait("document.querySelector('.watch-actions button[aria-pressed]').getAttribute('aria-pressed')==='false'");
  await evaluate("document.querySelector('.watch-actions button[aria-pressed]').click()");
  await wait("document.querySelector('.watch-actions button[aria-pressed]').getAttribute('aria-pressed')==='true'");
  await navigate("/profile?tab=list", ".profile-content .catalog-card");
  await evaluate("document.querySelector('.profile-content button[aria-label^=Hapus]').click()");
  await wait("!document.querySelector('.profile-content .catalog-card')");
  results.push({ check: "guest-watchlist-add-remove", passed: true });
  await navigate("/", ".content-shelf--ranked");
  await wait("[...document.querySelectorAll('.content-row h2')].some(h=>h.textContent==='Pilihan untuk Anda')");
  assert.equal(await evaluate(`[...document.querySelectorAll('.content-row')].find(row=>row.querySelector('h2')?.textContent==='Pilihan untuk Anda').querySelectorAll('a[href*=${JSON.stringify(fixture.id)}]').length`), 0);
  results.push({ check: "recommendations-exclude-watched-title", passed: true });
  const seriesHref = await evaluate("document.querySelector('.content-shelf--ranked a[href*=\"type=drakor\"]')?.getAttribute('href')");
  if (seriesHref) {
    await navigate(seriesHref, ".episode-link");
    const episodeHref = await evaluate("[...document.querySelectorAll('.episode-link')].find(e=>e.getAttribute('aria-current')!=='true')?.getAttribute('href')");
    if (episodeHref) {
      await navigate(episodeHref, ".episode-link[aria-current=true]");
      assert.equal(await evaluate("new URL(document.querySelector('.episode-link[aria-current=true]').href).search"), new URL(episodeHref, base).search);
      const serverHref = await evaluate("[...document.querySelectorAll('.server-option')].find(e=>e.getAttribute('aria-current')!=='true').getAttribute('href')");
      await navigate(serverHref, ".server-option[aria-current=true]");
      assert.equal(await evaluate("new URL(document.querySelector('.server-option[aria-current=true]').href).search"), new URL(serverHref, base).search);
      results.push({ check: "series-episode-and-server-navigation", passed: true });
    }
  }
  assert.deepEqual(errors, [], "Uncaught browser exceptions");
  await writeFile(join(output, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ passed: results.length, output }, null, 2));
} catch (error) {
  await screenshot("failure.png");
  const diagnostics = await evaluate("({url:location.href,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})).filter(e=>e.right>innerWidth+1).slice(0,12)})");
  console.error(JSON.stringify({ output, diagnostics }, null, 2));
  throw error;
} finally {
  await send("Browser.close", {}, null).catch(() => {});
  socket.close();
  if (browser.exitCode === null) browser.kill();
}
