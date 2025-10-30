const ALARM = "oi-capture-3min";
const KEY = "oi_target"; // { tabId, windowId }
function pad2(n) { return n < 10 ? "0" + n : "" + n; }
function hhmm() { const d = new Date(); return pad2(d.getHours()) + "-" + pad2(d.getMinutes()) }
function hhmmss() { const d = new Date(); return pad2(d.getHours()) + "-" + pad2(d.getMinutes()) + "-" + pad2(d.getSeconds()); }
function sanitizeFolder(s) {
  if (!s) return "UNKNOWN";
  s = s.replace(/[\\/:*?"<>|]+/g, "").trim();
  s = s.replace(/\s+/g, "_");
  if (s.length > 120) s = s.slice(0, 120);
  return s || "UNKNOWN";
}
async function readIOFromPage(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const sels = [
          '.MuiTypography-root.MuiTypography-body1.mui-style-dgesov',
          '[class*="MuiTypography-root"][class*="MuiTypography-body1"][class*="mui-style-"]'
        ];
        for (const sel of sels) {
          const el = document.querySelector(sel);
          if (el && el.textContent) return el.textContent.trim();
        }
        return "";
      }
    });
    return results?.[0]?.result || "";
  } catch (e) {
    console.warn("[OI] readIOFromPage failed:", e);
    return "";
  }
}
async function captureAndDownload() {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.cmd === 'manual-screenshot' && msg.tabId && msg.windowId) {
      (async () => {
        console.log("called 1");
        const ioRaw = await readIOFromPage(msg.tabId);
        const io = sanitizeFolder(ioRaw);
        console.log("called 2");
        
        chrome.tabs.captureVisibleTab(msg.windowId, { format: 'png' }, (dataUrl) => {
          if (!dataUrl) return;
          const filename = `screept_shot/${io}/${hhmmss()}.png`;
          chrome.downloads.download({ url: dataUrl, filename });
        });
      })();
    }
  });
  const { [KEY]: target } = await chrome.storage.local.get(KEY);
  if (!target) return;
  const { tabId, windowId } = target;
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) return;
    const ioRaw = await readIOFromPage(tabId);
    const io = sanitizeFolder(ioRaw);
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
  const filename = `screept_shot/${io}/${hhmm()}.png`;
    await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
  } catch (e) {
    console.warn("[OI] capture failed:", e);
  }
}
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.cmd === "manual-screenshot") {
      await captureAndDownload();
    }else if (msg?.cmd === "start") {
      await chrome.storage.local.set({ [KEY]: { tabId: msg.tabId, windowId: msg.windowId } });
      await chrome.alarms.clear(ALARM);
      await chrome.alarms.create(ALARM, { periodInMinutes: 3 });
      await captureAndDownload();
      sendResponse({ ok: true });
    } else if (msg?.cmd === "stop") {
      await chrome.alarms.clear(ALARM);
      await chrome.storage.local.remove(KEY);
      sendResponse({ ok: true });
    }
  })();
  return true;
});
chrome.alarms.onAlarm.addListener(a => { if (a.name === ALARM) captureAndDownload(); });