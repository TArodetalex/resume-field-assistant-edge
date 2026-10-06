async function togglePanel(tab) {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "RESUME_ASSISTANT_TOGGLE" });
  } catch (_) {
    // edge://、扩展商店等受保护页面不允许注入脚本。
  }
}

chrome.action.onClicked.addListener(togglePanel);

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-panel") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await togglePanel(tab);
});
