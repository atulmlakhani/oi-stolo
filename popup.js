async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
document.getElementById('inject').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    files: ['page-script.js']
  });
  window.close();
});
document.getElementById('manual').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  await chrome.runtime.sendMessage({ cmd: 'manual-screenshot', tabId: tab.id, windowId: tab.windowId });
  window.close();
});
document.getElementById('start').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  await chrome.runtime.sendMessage({ cmd: 'start', tabId: tab.id, windowId: tab.windowId });
  window.close();
});
document.getElementById('stop').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ cmd: 'stop' });
  window.close();
});