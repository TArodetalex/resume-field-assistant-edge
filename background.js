async function sendPanelMessage(tab, type) {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type });
    return { ok: true };
  } catch (_) {
    // 页面可能是在扩展安装或重新加载之前打开的，尝试主动补充脚本。
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: type === "RESUME_ASSISTANT_TOGGLE" ? "RESUME_ASSISTANT_SHOW" : type });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
    return { ok: true };
  } catch (_) {
    // edge://、新标签页、扩展商店、部分内置 PDF 等受保护页面不允许注入。
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#C93C4A" });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    await chrome.action.setTitle({ tabId: tab.id, title: "此页面不允许扩展显示侧栏" });
    return { ok: false, reason: "当前网站不允许显示侧栏" };
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
  chrome.action.setTitle({ tabId, title: "显示/隐藏简历字段助手" }).catch(() => {});
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-panel") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await sendPanelMessage(tab, "RESUME_ASSISTANT_TOGGLE");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "RFA_SHOW_ACTIVE_TAB") return;
  (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    sendResponse(await sendPanelMessage(tab, "RESUME_ASSISTANT_SHOW"));
  })();
  return true;
});
