const STORAGE_KEY = "resumeFieldAssistantData";
const VIEW_STORAGE_KEY = "resumeFieldAssistantViewState";

const select = document.getElementById("profile-select");
const count = document.getElementById("profile-count");
const status = document.getElementById("status");
const showButton = document.getElementById("show-panel");

function setStatus(text, type = "") {
  status.textContent = text;
  status.className = `status${type ? ` ${type}` : ""}`;
}

async function init() {
  document.getElementById("version").textContent = `版本 ${chrome.runtime.getManifest().version}`;
  const stored = await chrome.storage.local.get([STORAGE_KEY, VIEW_STORAGE_KEY]);
  const profiles = stored[STORAGE_KEY]?.profiles || [];
  const activeId = stored[VIEW_STORAGE_KEY]?.activeProfileId;
  count.textContent = String(profiles.length);
  select.replaceChildren();
  const items = profiles.length ? profiles : [{ id: "", name: "暂无套装" }];
  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  }
  if (profiles.some((item) => item.id === activeId)) select.value = activeId;
  showButton.disabled = profiles.length === 0;
}

select.addEventListener("change", async () => {
  const stored = await chrome.storage.local.get(VIEW_STORAGE_KEY);
  await chrome.storage.local.set({ [VIEW_STORAGE_KEY]: { ...(stored[VIEW_STORAGE_KEY] || {}), activeProfileId: select.value } });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "RESUME_ASSISTANT_SELECT_PROFILE", profileId: select.value }).catch(() => {});
  setStatus("套装已选择", "success");
});

showButton.addEventListener("click", async () => {
  showButton.disabled = true;
  setStatus("正在显示…");
  try {
    const result = await chrome.runtime.sendMessage({ type: "RFA_SHOW_ACTIVE_TAB" });
    setStatus(result?.ok ? "已显示固定侧栏" : (result?.reason || "弹出失败"), result?.ok ? "success" : "error");
  } catch (_) {
    setStatus("弹出失败，请刷新网页后重试", "error");
  } finally {
    showButton.disabled = false;
  }
});

init().catch(() => setStatus("读取套装失败", "error"));
