(() => {
  if (window.__resumeFieldAssistantLoaded) return;
  window.__resumeFieldAssistantLoaded = true;

  const STORAGE_KEY = "resumeFieldAssistantData";
  const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const defaultData = () => {
    const profileId = makeId();
    return {
      version: 1,
      activeProfileId: profileId,
      profiles: [{
        id: profileId,
        name: "示例岗位",
        sections: [
          {
            id: makeId(),
            name: "基本信息",
            fields: [
              { id: makeId(), label: "姓名", value: "请点击铅笔修改", type: "copy" },
              { id: makeId(), label: "可入职时间", value: "请按实际情况选择", type: "display" }
            ]
          },
          {
            id: makeId(),
            name: "教育经历",
            fields: [
              { id: makeId(), label: "学校名称", value: "示例大学", type: "copy" },
              { id: makeId(), label: "就读时间", value: "2020.09 — 2024.06", type: "display" }
            ]
          }
        ]
      }],
      history: [],
      panel: { width: 360, height: 680, top: 72, right: 18, collapsed: false, hidden: false }
    };
  };

  let data;
  let host;
  let root;
  let searchText = "";
  let toastTimer;
  let modalMode = null;
  let draggedField = null;

  const css = `
    :host { all: initial; color-scheme: light; }
    *, *::before, *::after { box-sizing: border-box; }
    button, input, select, textarea { font: inherit; }
    .rfa-panel {
      position: fixed; z-index: 2147483647; display: flex; flex-direction: column;
      width: 360px; height: min(680px, calc(100vh - 90px)); min-width: 280px; min-height: 240px;
      max-width: min(720px, calc(100vw - 12px)); max-height: calc(100vh - 12px);
      background: #f7f8fc; border: 1px solid rgba(17, 24, 39, .12); border-radius: 16px;
      box-shadow: 0 18px 55px rgba(15, 23, 42, .25); overflow: hidden; resize: both;
      color: #182230; font-family: Inter, "Microsoft YaHei", system-ui, sans-serif; font-size: 13px;
    }
    .rfa-panel.hidden { display: none; }
    .rfa-panel.collapsed { width: 278px !important; height: 44px !important; min-height: 44px; resize: none; }
    .rfa-panel.collapsed .rfa-body, .rfa-panel.collapsed .rfa-toolbar, .rfa-panel.collapsed .rfa-footer { display: none; }
    .rfa-header { height: 44px; flex: 0 0 44px; padding: 7px 7px 7px 10px; display: flex; align-items: center; gap: 6px; background: #172554; color: white; cursor: move; user-select: none; }
    .rfa-mark { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 6px; background: #4f7cff; font-weight: 800; font-size: 11px; }
    .rfa-title { min-width: 0; flex: 1; font-weight: 700; letter-spacing: .2px; }
    .rfa-icon { width: 28px; height: 28px; border: 0; border-radius: 7px; background: rgba(255,255,255,.1); color: white; cursor: pointer; }
    .rfa-icon:hover { background: rgba(255,255,255,.2); }
    .rfa-toolbar { padding: 7px; background: white; border-bottom: 1px solid #e6e8ef; }
    .rfa-profile-row { display: flex; gap: 5px; margin-bottom: 6px; }
    .rfa-select, .rfa-input, .rfa-textarea { width: 100%; border: 1px solid #d6dae5; background: white; color: #182230; border-radius: 9px; outline: 0; }
    .rfa-select, .rfa-input { height: 31px; padding: 0 9px; }
    .rfa-select:focus, .rfa-input:focus, .rfa-textarea:focus { border-color: #4f7cff; box-shadow: 0 0 0 3px rgba(79,124,255,.13); }
    .rfa-small-btn { flex: 0 0 auto; height: 31px; padding: 0 9px; border: 1px solid #d6dae5; border-radius: 8px; background: #fff; color: #314158; cursor: pointer; }
    .rfa-small-btn:hover { background: #f2f5ff; border-color: #aebdeb; }
    .rfa-search-wrap { position: relative; }
    .rfa-search { padding-left: 32px; }
    .rfa-search-icon { position: absolute; left: 10px; top: 6px; color: #718096; }
    .rfa-body { flex: 1; min-height: 0; overflow: auto; padding: 7px; }
    .rfa-section { margin-bottom: 7px; border: 1px solid #e2e5ed; background: #fff; border-radius: 10px; overflow: hidden; }
    .rfa-section-head { display: flex; align-items: center; min-height: 32px; padding: 3px 5px 3px 9px; background: #f0f3fa; }
    .rfa-section-name { flex: 1; font-size: 12px; font-weight: 800; color: #46536a; text-transform: uppercase; letter-spacing: .5px; }
    .rfa-edit { width: 27px; height: 27px; border: 0; border-radius: 7px; color: #758196; background: transparent; cursor: pointer; }
    .rfa-edit:hover { color: #2f5fea; background: #e4eaff; }
    .rfa-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; padding: 6px; }
    .rfa-field { min-width: 0; height: 34px; display: grid; grid-template-columns: 16px minmax(0, 1fr) 27px; align-items: center; gap: 2px; border: 1px solid #e3e7ef; border-radius: 8px; background: #fbfcfe; overflow: hidden; transition: opacity .12s, border-color .12s, box-shadow .12s; }
    .rfa-field.dragging { opacity: .35; }
    .rfa-field.drop-target { border-color: #4f7cff; box-shadow: 0 0 0 2px rgba(79,124,255,.2); }
    .rfa-fields.drop-zone { background: #eef3ff; outline: 1px dashed #7695ee; outline-offset: -3px; }
    .rfa-drag-handle { width: 16px; height: 30px; display: grid; place-items: center; color: #9aa4b5; cursor: grab; user-select: none; font-size: 12px; }
    .rfa-drag-handle:active { cursor: grabbing; }
    .rfa-field-main { min-width: 0; height: 32px; display: flex; align-items: center; gap: 5px; padding: 0 4px 0 8px; border: 0; border-radius: 7px; background: transparent; color: #294eae; text-align: left; cursor: pointer; }
    .rfa-field-main:hover { background: #eaf0ff; }
    .rfa-field-main:active { transform: translateY(1px); }
    .rfa-field-main.display { color: #596579; }
    .rfa-field-main.display:hover { background: #f0f2f6; }
    .rfa-field-icon { flex: 0 0 auto; width: 14px; color: #8792a6; font-size: 10px; }
    .rfa-field-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 650; }
    .rfa-field .rfa-edit { width: 25px; height: 25px; }
    .rfa-hover-card { position: absolute; z-index: 30; width: max-content; max-width: min(330px, calc(100% - 16px)); max-height: 220px; overflow: auto; padding: 9px 11px; border: 1px solid #d9deea; border-radius: 9px; background: rgba(255,255,255,.98); color: #26344b; box-shadow: 0 10px 28px rgba(15,23,42,.2); font-size: 12px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; pointer-events: none; }
    .rfa-empty { grid-column: 1 / -1; padding: 34px 18px; text-align: center; color: #7d8798; line-height: 1.7; }
    .rfa-footer { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 5px; padding: 7px 8px 8px; background: #fff; border-top: 1px solid #e6e8ef; }
    .rfa-primary { background: #315fe8; border-color: #315fe8; color: white; }
    .rfa-primary:hover { background: #244fcf; border-color: #244fcf; }
    .rfa-overlay { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; padding: 12px; background: rgba(15,23,42,.42); backdrop-filter: blur(2px); }
    .rfa-dialog { width: min(470px, 100%); max-height: 94%; display: flex; flex-direction: column; border-radius: 14px; background: white; box-shadow: 0 22px 65px rgba(0,0,0,.3); overflow: hidden; }
    .rfa-dialog-head { display: flex; align-items: center; padding: 13px 14px; border-bottom: 1px solid #e8eaf0; }
    .rfa-dialog-title { flex: 1; font-weight: 800; font-size: 15px; }
    .rfa-dialog-body { padding: 14px; overflow: auto; }
    .rfa-form-row { margin-bottom: 12px; }
    .rfa-form-row label { display: block; margin-bottom: 5px; color: #536075; font-size: 12px; font-weight: 700; }
    .rfa-textarea { min-height: 112px; padding: 9px 10px; resize: vertical; line-height: 1.5; }
    .rfa-import-text { min-height: 240px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; }
    .rfa-help { margin: 0 0 10px; padding: 9px 10px; background: #f2f5ff; border-radius: 9px; color: #506080; font-size: 11px; line-height: 1.55; white-space: pre-wrap; }
    .rfa-history-list { display: grid; gap: 7px; }
    .rfa-history-item { padding: 9px 10px; border: 1px solid #e2e6ee; border-radius: 9px; background: #fafbfe; }
    .rfa-history-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .rfa-history-action { flex: 0 0 auto; padding: 2px 6px; border-radius: 5px; background: #e8efff; color: #3159bd; font-size: 11px; font-weight: 750; }
    .rfa-history-time { margin-left: auto; color: #8a94a5; font-size: 10px; }
    .rfa-history-path { color: #3f4c61; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
    .rfa-dialog-foot { display: flex; justify-content: space-between; gap: 8px; padding: 10px 14px 14px; }
    .rfa-danger { color: #c0364a; border-color: #efc4cb; }
    .rfa-actions-right { display: flex; gap: 7px; margin-left: auto; }
    .rfa-toast { position: absolute; z-index: 40; left: 50%; bottom: 58px; transform: translateX(-50%); max-width: 85%; padding: 8px 12px; border-radius: 9px; color: white; background: rgba(15,23,42,.92); box-shadow: 0 8px 25px rgba(0,0,0,.25); text-align: center; pointer-events: none; }
  `;

  async function load() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    data = stored[STORAGE_KEY] || defaultData();
    if (!data.panel) data.panel = defaultData().panel;
    if (!Array.isArray(data.history)) data.history = [];
    mount();
  }

  function save() {
    return chrome.storage.local.set({ [STORAGE_KEY]: data });
  }

  function recordChange(action, profileName, sectionName = "—", fieldName = "—") {
    if (!Array.isArray(data.history)) data.history = [];
    data.history.unshift({ id: makeId(), timestamp: new Date().toISOString(), action, profileName, sectionName, fieldName });
    data.history = data.history.slice(0, 300);
  }

  async function refreshData() {
    const currentPanel = { ...data.panel };
    const currentProfileId = data.activeProfileId;
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const fresh = stored[STORAGE_KEY];
    if (!fresh?.profiles?.length) return toast("没有找到可刷新的数据");
    fresh.panel = currentPanel;
    fresh.history = Array.isArray(fresh.history) ? fresh.history : [];
    if (fresh.profiles.some((item) => item.id === currentProfileId)) fresh.activeProfileId = currentProfileId;
    data = fresh;
    modalMode = null;
    render({ preserveScroll: true });
    toast("数据已刷新");
  }

  function activeProfile() {
    return data.profiles.find((item) => item.id === data.activeProfileId) || data.profiles[0];
  }

  function mount() {
    host = document.createElement("div");
    host.id = "resume-field-assistant-host";
    root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${css}</style><div class="rfa-panel"></div>`;
    document.documentElement.appendChild(host);
    isolateEditorEvents();
    render();
    wireDragAndResize();
  }

  function isolateEditorEvents() {
    // 一些网申页面会在 document 上接管 Backspace/Delete 或快捷键。
    // 事件离开 Shadow DOM 前将其截住，避免页面阻止插件内的正常编辑。
    const editorEventTypes = ["keydown", "keyup", "keypress", "beforeinput", "input", "paste", "cut", "copy"];
    for (const type of editorEventTypes) {
      root.addEventListener(type, (event) => {
        const path = event.composedPath();
        const isEditor = path.some((node) => node?.matches?.("input, textarea, select, [contenteditable='true']"));
        if (isEditor) event.stopPropagation();
      });
    }
  }

  function render({ preserveScroll = false } = {}) {
    const previousScrollTop = preserveScroll ? (root.querySelector(".rfa-body")?.scrollTop || 0) : 0;
    const panel = root.querySelector(".rfa-panel");
    const p = activeProfile();
    const panelState = data.panel;
    panel.className = `rfa-panel${panelState.collapsed ? " collapsed" : ""}${panelState.hidden ? " hidden" : ""}`;
    panel.style.width = `${panelState.width || 360}px`;
    panel.style.height = `${panelState.height || 680}px`;
    panel.style.top = `${Math.max(6, Math.min(panelState.top ?? 72, window.innerHeight - 54))}px`;
    panel.style.right = `${Math.max(6, panelState.right ?? 18)}px`;

    const query = searchText.trim().toLowerCase();
    const sectionsHtml = p.sections.map((section) => {
      const fields = section.fields.filter((field) => !query || `${section.name} ${field.label} ${field.value}`.toLowerCase().includes(query));
      if (query && fields.length === 0) return "";
      return `<section class="rfa-section">
        <div class="rfa-section-head">
          <div class="rfa-section-name">${escapeHtml(section.name)}</div>
          <button class="rfa-edit" data-action="edit-section" data-section="${section.id}" title="编辑板块">✎</button>
        </div>
        <div class="rfa-fields" data-section="${section.id}">${fields.map((field) => `
          <div class="rfa-field" data-section="${section.id}" data-field="${field.id}">
            <span class="rfa-drag-handle" draggable="true" data-section="${section.id}" data-field="${field.id}" title="拖动调整位置">⠿</span>
            <button class="rfa-field-main ${field.type === "display" ? "display" : ""}" data-action="${field.type === "copy" ? "copy" : "preview"}" data-section="${section.id}" data-field="${field.id}" aria-label="${field.type === "copy" ? "复制" : "查看"}：${escapeHtml(field.label)}">
              <span class="rfa-field-icon">${field.type === "copy" ? "▣" : "◉"}</span><span class="rfa-field-label">${escapeHtml(field.label)}</span>
            </button>
            <button class="rfa-edit" data-action="edit-field" data-section="${section.id}" data-field="${field.id}" title="编辑字段">✎</button>
          </div>`).join("") || `<div class="rfa-empty">这个板块还没有字段</div>`}
        </div>
      </section>`;
    }).join("");

    panel.innerHTML = `
      <div class="rfa-header">
        <div class="rfa-mark">CV</div><div class="rfa-title">简历字段助手</div>
        <button class="rfa-icon" data-action="full-height" title="贴边全高">↕</button>
        <button class="rfa-icon" data-action="collapse" title="收起/展开">${panelState.collapsed ? "□" : "—"}</button>
        <button class="rfa-icon" data-action="hide" title="隐藏（Alt+Shift+R 恢复）">×</button>
      </div>
      <div class="rfa-toolbar">
        <div class="rfa-profile-row">
          <select class="rfa-select" data-action="profile-select" aria-label="选择岗位套装">
            ${data.profiles.map((profile) => `<option value="${profile.id}" ${profile.id === p.id ? "selected" : ""}>${escapeHtml(profile.name)}</option>`).join("")}
          </select>
          <button class="rfa-small-btn" data-action="profile-menu" title="管理岗位套装">管理</button>
          <button class="rfa-small-btn" data-action="refresh-data" title="读取其他页面的最新修改">刷新</button>
          <button class="rfa-small-btn" data-action="history" title="查看修改记录">记录</button>
        </div>
        <div class="rfa-search-wrap"><span class="rfa-search-icon">⌕</span><input class="rfa-input rfa-search" data-action="search" value="${escapeHtml(searchText)}" placeholder="搜索字段名称或内容"></div>
      </div>
      <main class="rfa-body">${sectionsHtml || `<div class="rfa-empty">没有找到相关字段<br>可以换个关键词试试</div>`}</main>
      <footer class="rfa-footer">
        <button class="rfa-small-btn" data-action="add-field">＋字段</button>
        <button class="rfa-small-btn" data-action="add-section">＋板块</button>
        <button class="rfa-small-btn rfa-primary" data-action="bulk-import">批量导入</button>
      </footer>`;
    bindEvents();
    if (preserveScroll) root.querySelector(".rfa-body").scrollTop = previousScrollTop;
    if (modalMode) openModal(modalMode, true);
  }

  function bindEvents() {
    const panel = root.querySelector(".rfa-panel");
    panel.querySelectorAll(".rfa-field-main").forEach((element) => {
      element.addEventListener("mouseenter", () => showFieldTooltip(element));
      element.addEventListener("mouseleave", hideFieldTooltip);
      element.addEventListener("focus", () => showFieldTooltip(element));
      element.addEventListener("blur", hideFieldTooltip);
    });
    panel.querySelectorAll("[data-action]").forEach((element) => {
      const action = element.dataset.action;
      if (action === "search") {
        element.addEventListener("input", (event) => {
          searchText = event.target.value;
          const pos = event.target.selectionStart;
          render();
          const next = root.querySelector('[data-action="search"]');
          next.focus(); next.setSelectionRange(pos, pos);
        });
      } else if (action === "profile-select") {
        element.addEventListener("change", async (event) => { data.activeProfileId = event.target.value; await save(); render(); });
      } else if (action === "copy") {
        element.addEventListener("click", () => copyField(element.dataset.section, element.dataset.field));
      } else if (action === "preview") {
        element.addEventListener("click", () => previewField(element.dataset.section, element.dataset.field));
      } else if (action === "full-height") {
        element.addEventListener("click", toggleFullHeight);
      } else if (action === "collapse") {
        element.addEventListener("click", async () => { data.panel.collapsed = !data.panel.collapsed; await save(); render(); });
      } else if (action === "hide") {
        element.addEventListener("click", async () => { data.panel.hidden = true; await save(); render(); });
      } else if (action === "add-field") element.addEventListener("click", () => showFieldDialog());
      else if (action === "edit-field") element.addEventListener("click", () => showFieldDialog(element.dataset.section, element.dataset.field));
      else if (action === "add-section") element.addEventListener("click", () => showSectionDialog());
      else if (action === "edit-section") element.addEventListener("click", () => showSectionDialog(element.dataset.section));
      else if (action === "profile-menu") element.addEventListener("click", showProfileDialog);
      else if (action === "refresh-data") element.addEventListener("click", refreshData);
      else if (action === "history") element.addEventListener("click", showHistoryDialog);
      else if (action === "bulk-import") element.addEventListener("click", showImportDialog);
    });
    bindFieldDragging(panel);
  }

  function bindFieldDragging(panel) {
    panel.querySelectorAll(".rfa-drag-handle").forEach((handle) => {
      handle.addEventListener("dragstart", (event) => {
        hideFieldTooltip();
        draggedField = { sectionId: handle.dataset.section, fieldId: handle.dataset.field };
        handle.closest(".rfa-field")?.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", handle.dataset.field);
        event.stopPropagation();
      });
      handle.addEventListener("dragend", () => {
        draggedField = null;
        clearDragStyles();
      });
    });

    panel.querySelectorAll(".rfa-fields").forEach((zone) => {
      zone.addEventListener("dragover", (event) => {
        if (!draggedField) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        clearDragStyles(true);
        const targetCard = event.target.closest?.(".rfa-field");
        if (targetCard && targetCard.dataset.field !== draggedField.fieldId) targetCard.classList.add("drop-target");
        else zone.classList.add("drop-zone");
      });
      zone.addEventListener("drop", async (event) => {
        if (!draggedField) return;
        event.preventDefault();
        event.stopPropagation();
        const targetCard = event.target.closest?.(".rfa-field");
        await moveField(draggedField, zone.dataset.section, targetCard, event.clientX);
      });
    });
  }

  function clearDragStyles(keepDragging = false) {
    root.querySelectorAll(".rfa-field").forEach((node) => {
      node.classList.remove("drop-target");
      if (!keepDragging) node.classList.remove("dragging");
    });
    root.querySelectorAll(".rfa-fields").forEach((node) => node.classList.remove("drop-zone"));
  }

  async function moveField(source, targetSectionId, targetCard, pointerX) {
    if (targetCard?.dataset.field === source.fieldId) {
      draggedField = null;
      clearDragStyles();
      return;
    }
    const profile = activeProfile();
    const sourceSection = profile.sections.find((item) => item.id === source.sectionId);
    const targetSection = profile.sections.find((item) => item.id === targetSectionId);
    const sourceIndex = sourceSection?.fields.findIndex((item) => item.id === source.fieldId) ?? -1;
    if (!sourceSection || !targetSection || sourceIndex < 0) return;
    const [field] = sourceSection.fields.splice(sourceIndex, 1);
    let targetIndex = targetSection.fields.length;
    if (targetCard && targetCard.dataset.field !== source.fieldId) {
      const cardIndex = targetSection.fields.findIndex((item) => item.id === targetCard.dataset.field);
      if (cardIndex >= 0) {
        const rect = targetCard.getBoundingClientRect();
        targetIndex = cardIndex + (pointerX >= rect.left + rect.width / 2 ? 1 : 0);
      }
    }
    targetSection.fields.splice(targetIndex, 0, field);
    recordChange(source.sectionId === targetSectionId ? "调整顺序" : "跨板块移动", profile.name, targetSection.name, field.label);
    draggedField = null;
    await save();
    render({ preserveScroll: true });
    toast(source.sectionId === targetSectionId ? "字段顺序已更新" : "字段已移动到其他板块");
  }

  async function copyField(sectionId, fieldId) {
    hideFieldTooltip();
    const section = activeProfile().sections.find((item) => item.id === sectionId);
    const field = section?.fields.find((item) => item.id === fieldId);
    if (!field) return;
    try {
      await navigator.clipboard.writeText(field.value);
      toast(`已复制：${field.label}`);
    } catch (_) {
      const text = document.createElement("textarea");
      text.value = field.value; document.body.appendChild(text); text.select();
      document.execCommand("copy"); text.remove();
      toast(`已复制：${field.label}`);
    }
  }

  function previewField(sectionId, fieldId) {
    hideFieldTooltip();
    const section = activeProfile().sections.find((item) => item.id === sectionId);
    const field = section?.fields.find((item) => item.id === fieldId);
    if (!field) return;
    modalMode = { type: "preview", sectionId, fieldId };
    openModal(modalMode);
  }

  function showFieldTooltip(element) {
    hideFieldTooltip();
    const section = activeProfile().sections.find((item) => item.id === element.dataset.section);
    const field = section?.fields.find((item) => item.id === element.dataset.field);
    if (!field) return;
    const panel = root.querySelector(".rfa-panel");
    const panelRect = panel.getBoundingClientRect();
    const targetRect = element.getBoundingClientRect();
    const tooltip = document.createElement("div");
    tooltip.className = "rfa-hover-card";
    tooltip.textContent = field.value || "（内容为空）";
    panel.appendChild(tooltip);
    const tipRect = tooltip.getBoundingClientRect();
    const maxLeft = Math.max(8, panelRect.width - tipRect.width - 8);
    const left = Math.max(8, Math.min(targetRect.left - panelRect.left, maxLeft));
    let top = targetRect.bottom - panelRect.top + 5;
    if (top + tipRect.height > panelRect.height - 8) top = Math.max(8, targetRect.top - panelRect.top - tipRect.height - 5);
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function hideFieldTooltip() {
    root.querySelector(".rfa-hover-card")?.remove();
  }

  async function toggleFullHeight() {
    const panel = root.querySelector(".rfa-panel");
    if (!data.panel.fullHeight) {
      const rect = panel.getBoundingClientRect();
      data.panel.restoreGeometry = {
        top: Math.round(rect.top), right: Math.round(window.innerWidth - rect.right),
        width: Math.round(rect.width), height: Math.round(rect.height)
      };
      data.panel.top = 6;
      data.panel.right = 6;
      data.panel.height = Math.max(240, window.innerHeight - 12);
      data.panel.fullHeight = true;
    } else {
      Object.assign(data.panel, data.panel.restoreGeometry || { top: 72, right: 18, width: 360, height: 680 });
      data.panel.fullHeight = false;
    }
    await save(); render();
  }

  function toast(message) {
    root.querySelector(".rfa-toast")?.remove();
    const node = document.createElement("div");
    node.className = "rfa-toast"; node.textContent = message;
    root.querySelector(".rfa-panel").appendChild(node);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.remove(), 1600);
  }

  function dialog(title, body, { saveText = "保存", onSave, onDelete } = {}) {
    root.querySelector(".rfa-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "rfa-overlay";
    overlay.innerHTML = `<div class="rfa-dialog" role="dialog" aria-modal="true">
      <div class="rfa-dialog-head"><div class="rfa-dialog-title">${escapeHtml(title)}</div><button class="rfa-small-btn" data-close>取消</button></div>
      <div class="rfa-dialog-body">${body}</div>
      <div class="rfa-dialog-foot">
        <div>${onDelete ? `<button class="rfa-small-btn rfa-danger" data-delete>删除</button>` : ""}</div>
        <div class="rfa-actions-right"><button class="rfa-small-btn" data-close>取消</button><button class="rfa-small-btn rfa-primary" data-save>${escapeHtml(saveText)}</button></div>
      </div>
    </div>`;
    root.querySelector(".rfa-panel").appendChild(overlay);
    overlay.querySelectorAll("[data-close]").forEach((node) => node.addEventListener("click", closeModal));
    overlay.addEventListener("click", (event) => { if (event.target === overlay) closeModal(); });
    overlay.querySelector("[data-save]").addEventListener("click", () => onSave?.(overlay));
    overlay.querySelector("[data-delete]")?.addEventListener("click", () => onDelete?.(overlay));
    setTimeout(() => overlay.querySelector("input, textarea, select")?.focus(), 0);
  }

  function closeModal() { modalMode = null; root.querySelector(".rfa-overlay")?.remove(); }

  function showFieldDialog(sectionId, fieldId) {
    modalMode = { type: "field", sectionId, fieldId };
    openModal(modalMode);
  }

  function showSectionDialog(sectionId) {
    modalMode = { type: "section", sectionId };
    openModal(modalMode);
  }

  function showProfileDialog() {
    modalMode = { type: "profile" };
    openModal(modalMode);
  }

  function showImportDialog() {
    modalMode = { type: "import" };
    openModal(modalMode);
  }

  function showHistoryDialog() {
    modalMode = { type: "history" };
    openModal(modalMode);
  }

  function openModal(mode, restoring = false) {
    if (!restoring) root.querySelector(".rfa-overlay")?.remove();
    const p = activeProfile();
    if (mode.type === "field") {
      const section = p.sections.find((item) => item.id === mode.sectionId) || p.sections[0];
      const field = section?.fields.find((item) => item.id === mode.fieldId);
      if (!p.sections.length) { toast("请先新增一个板块"); modalMode = null; return; }
      dialog(field ? "编辑字段" : "新增字段", `
        <div class="rfa-form-row"><label>所属板块</label><select class="rfa-select" name="section">${p.sections.map((item) => `<option value="${item.id}" ${item.id === section.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div>
        <div class="rfa-form-row"><label>字段名称</label><input class="rfa-input" name="label" value="${escapeHtml(field?.label || "")}" placeholder="例如：学校名称"></div>
        <div class="rfa-form-row"><label>字段类型</label><select class="rfa-select" name="type"><option value="copy" ${field?.type !== "display" ? "selected" : ""}>点击复制</option><option value="display" ${field?.type === "display" ? "selected" : ""}>仅展示（不会复制）</option></select></div>
        <div class="rfa-form-row"><label>内容</label><textarea class="rfa-textarea" name="value" placeholder="填写字段内容">${escapeHtml(field?.value || "")}</textarea></div>`, {
        onSave: async (box) => {
          const label = box.querySelector('[name="label"]').value.trim();
          const value = box.querySelector('[name="value"]').value.trim();
          const targetSection = p.sections.find((item) => item.id === box.querySelector('[name="section"]').value);
          if (!label) return toast("请填写字段名称");
          let action = field ? "修改字段" : "新增字段";
          if (field) {
            const oldSection = p.sections.find((item) => item.fields.some((f) => f.id === field.id));
            Object.assign(field, { label, value, type: box.querySelector('[name="type"]').value });
            if (oldSection.id !== targetSection.id) { oldSection.fields = oldSection.fields.filter((f) => f.id !== field.id); targetSection.fields.push(field); action = "修改并移动"; }
          } else targetSection.fields.push({ id: makeId(), label, value, type: box.querySelector('[name="type"]').value });
          recordChange(action, p.name, targetSection.name, label);
          modalMode = null; await save(); render({ preserveScroll: true }); toast(field ? "字段已更新" : "字段已新增");
        },
        onDelete: field ? async () => {
          if (!confirm(`确定删除“${field.label}”吗？`)) return;
          recordChange("删除字段", p.name, section.name, field.label);
          section.fields = section.fields.filter((item) => item.id !== field.id);
          modalMode = null; await save(); render({ preserveScroll: true });
        } : null
      });
    } else if (mode.type === "section") {
      const section = p.sections.find((item) => item.id === mode.sectionId);
      dialog(section ? "编辑板块" : "新增板块", `<div class="rfa-form-row"><label>板块名称</label><input class="rfa-input" name="name" value="${escapeHtml(section?.name || "")}" placeholder="例如：实习经历"></div>`, {
        onSave: async (box) => {
          const name = box.querySelector('[name="name"]').value.trim(); if (!name) return toast("请填写板块名称");
          if (section) { section.name = name; recordChange("修改板块", p.name, name); }
          else { p.sections.push({ id: makeId(), name, fields: [] }); recordChange("新增板块", p.name, name); }
          modalMode = null; await save(); render();
        },
        onDelete: section ? async () => {
          if (!confirm(`删除“${section.name}”及其中全部字段？`)) return;
          recordChange("删除板块", p.name, section.name);
          p.sections = p.sections.filter((item) => item.id !== section.id);
          modalMode = null; await save(); render();
        } : null
      });
    } else if (mode.type === "profile") {
      dialog("管理岗位套装", `
        <div class="rfa-form-row"><label>当前套装名称</label><input class="rfa-input" name="name" value="${escapeHtml(p.name)}"></div>
        <div class="rfa-help">“新增空白套装”适合从头填写；“复制当前套装”适合基于相近岗位微调。</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap"><button class="rfa-small-btn" data-new>新增空白套装</button><button class="rfa-small-btn" data-clone>复制当前套装</button><button class="rfa-small-btn" data-export>导出备份</button><button class="rfa-small-btn" data-import-json>导入备份</button><input type="file" accept="application/json" data-json-file hidden></div>`, {
        onSave: async (box) => { const name = box.querySelector('[name="name"]').value.trim(); if (!name) return toast("请填写套装名称"); p.name = name; recordChange("修改套装", name); modalMode = null; await save(); render(); },
        onDelete: data.profiles.length > 1 ? async () => { if (!confirm(`确定删除套装“${p.name}”吗？`)) return; recordChange("删除套装", p.name); data.profiles = data.profiles.filter((item) => item.id !== p.id); data.activeProfileId = data.profiles[0].id; modalMode = null; await save(); render(); } : null
      });
      const box = root.querySelector(".rfa-overlay");
      box.querySelector("[data-new]").addEventListener("click", async () => { const profile = { id: makeId(), name: "新岗位套装", sections: [] }; data.profiles.push(profile); data.activeProfileId = profile.id; recordChange("新增套装", profile.name); modalMode = null; await save(); render(); showProfileDialog(); });
      box.querySelector("[data-clone]").addEventListener("click", async () => { const profile = cloneProfile(p); data.profiles.push(profile); data.activeProfileId = profile.id; recordChange("复制套装", profile.name); modalMode = null; await save(); render(); toast("已复制套装"); });
      box.querySelector("[data-export]").addEventListener("click", exportData);
      box.querySelector("[data-import-json]").addEventListener("click", () => box.querySelector("[data-json-file]").click());
      box.querySelector("[data-json-file]").addEventListener("change", importJson);
    } else if (mode.type === "preview") {
      const section = p.sections.find((item) => item.id === mode.sectionId);
      const field = section?.fields.find((item) => item.id === mode.fieldId);
      if (!field) { modalMode = null; return; }
      dialog(field.label, `<div class="rfa-help" style="font-size:12px;white-space:pre-wrap;max-height:320px;overflow:auto">${escapeHtml(field.value) || "（内容为空）"}</div>`, {
        saveText: "编辑",
        onSave: () => { closeModal(); showFieldDialog(section.id, field.id); }
      });
    } else if (mode.type === "history") {
      const items = (data.history || []).map((item) => `
        <div class="rfa-history-item">
          <div class="rfa-history-top"><span class="rfa-history-action">${escapeHtml(item.action)}</span><span class="rfa-history-time">${escapeHtml(new Date(item.timestamp).toLocaleString("zh-CN", { hour12: false }))}</span></div>
          <div class="rfa-history-path">套装：${escapeHtml(item.profileName || "—")}<br>板块：${escapeHtml(item.sectionName || "—")}<br>字段：${escapeHtml(item.fieldName || "—")}</div>
        </div>`).join("");
      dialog("修改记录", `
        <div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="rfa-small-btn rfa-danger" data-clear-history>清空记录</button></div>
        <div class="rfa-history-list">${items || `<div class="rfa-empty">还没有修改记录</div>`}</div>`, {
        saveText: "关闭",
        onSave: closeModal
      });
      root.querySelector("[data-clear-history]").addEventListener("click", async () => {
        if (!data.history.length || !confirm("确定清空全部修改记录吗？")) return;
        data.history = [];
        await save();
        closeModal();
        toast("修改记录已清空");
      });
    } else if (mode.type === "import") {
      dialog("批量 Markdown 导入", `
        <div class="rfa-help">格式规则：\n# 套装: 校招产品经理\n## 教育经历\n- [复制] 学校名称: 示例大学\n- [展示] 就读时间: 2020.09 - 2024.06\n\n长文本可写在下一行并缩进两个空格。即使复制时换行和空格都被删除，也会按格式标记自动识别。再次导入会新增一个套装，不会覆盖现有数据。</div>
        <textarea class="rfa-textarea rfa-import-text" name="markdown" placeholder="# 套装: 岗位名称&#10;## 基本信息&#10;- [复制] 姓名: 张三&#10;- [展示] 可入职时间: 一个月内"></textarea>`, {
        saveText: "解析并导入",
        onSave: async (box) => {
          try {
            const profile = parseMarkdown(box.querySelector('[name="markdown"]').value);
            data.profiles.push(profile); data.activeProfileId = profile.id; modalMode = null;
            recordChange("批量导入套装", profile.name);
            await save(); render(); toast(`已导入 ${profile.sections.reduce((n, s) => n + s.fields.length, 0)} 个字段`);
          } catch (error) { toast(error.message); }
        }
      });
    }
  }

  function cloneProfile(profile) {
    return { id: makeId(), name: `${profile.name} - 副本`, sections: profile.sections.map((section) => ({ id: makeId(), name: section.name, fields: section.fields.map((field) => ({ ...field, id: makeId() })) })) };
  }

  function parseMarkdown(markdown) {
    // 某些富文本界面复制时会吞掉换行，甚至不留下空格。先用 Markdown
    // 的结构标记重新切行，让完全粘连成一整行的输入也能正常解析。
    const normalized = markdown
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/([^#\n])(?=#{1,2}\s+)/g, "$1\n")
      .replace(/([^\n])(?=[-*]\s*\[(?:复制|展示)\]\s*)/g, "$1\n");
    const lines = normalized.split("\n");
    let name = "导入的岗位套装";
    const sections = [];
    let currentSection = null;
    let currentField = null;
    for (const raw of lines) {
      const line = raw.trimEnd();
      const profileMatch = line.match(/^#\s+(?:套装|岗位|方案)\s*[:：]\s*(.+)$/);
      if (profileMatch) { name = profileMatch[1].trim(); continue; }
      const sectionMatch = line.match(/^##\s+(.+)$/);
      if (sectionMatch) { currentSection = { id: makeId(), name: sectionMatch[1].trim(), fields: [] }; sections.push(currentSection); currentField = null; continue; }
      const fieldMatch = line.match(/^\s*[-*]\s*\[(复制|展示)\]\s*([^:：]+)\s*[:：]\s*(.*)$/);
      if (fieldMatch) {
        if (!currentSection) { currentSection = { id: makeId(), name: "未分组", fields: [] }; sections.push(currentSection); }
        currentField = { id: makeId(), type: fieldMatch[1] === "复制" ? "copy" : "display", label: fieldMatch[2].trim(), value: fieldMatch[3].trim() };
        currentSection.fields.push(currentField); continue;
      }
      if (/^\s{2,}\S/.test(raw) && currentField) currentField.value += `${currentField.value ? "\n" : ""}${raw.trim()}`;
    }
    const count = sections.reduce((total, section) => total + section.fields.length, 0);
    if (!count) throw new Error("没有识别到字段，请检查格式");
    return { id: makeId(), name, sections };
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `简历字段助手备份-${new Date().toISOString().slice(0, 10)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importJson(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.profiles) || !parsed.profiles.length) throw new Error();
      data = parsed; data.panel ||= defaultData().panel; data.history = Array.isArray(data.history) ? data.history : [];
      recordChange("导入备份", activeProfile()?.name || "—");
      modalMode = null; await save(); render(); toast("备份已导入");
    } catch (_) { toast("备份文件格式不正确"); }
  }

  function wireDragAndResize() {
    let drag = null;
    root.addEventListener("pointerdown", (event) => {
      const header = event.target.closest?.(".rfa-header");
      if (!header || event.target.closest("button")) return;
      const panel = root.querySelector(".rfa-panel"); const rect = panel.getBoundingClientRect();
      drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      header.setPointerCapture(event.pointerId); event.preventDefault();
    });
    root.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const panel = root.querySelector(".rfa-panel"); const width = panel.getBoundingClientRect().width;
      const left = Math.max(4, Math.min(window.innerWidth - width - 4, drag.left + event.clientX - drag.x));
      const top = Math.max(4, Math.min(window.innerHeight - 48, drag.top + event.clientY - drag.y));
      panel.style.left = `${left}px`; panel.style.right = "auto"; panel.style.top = `${top}px`;
    });
    root.addEventListener("pointerup", async () => {
      if (drag) {
        const rect = root.querySelector(".rfa-panel").getBoundingClientRect();
        data.panel.top = Math.round(rect.top); data.panel.right = Math.round(window.innerWidth - rect.right); drag = null; await save();
      }
    });
    const observer = new ResizeObserver(async (entries) => {
      if (!data || data.panel.collapsed) return;
      const rect = entries[0].contentRect;
      if (rect.width > 0 && rect.height > 0) { data.panel.width = Math.round(rect.width); data.panel.height = Math.round(rect.height); await save(); }
    });
    observer.observe(root.querySelector(".rfa-panel"));
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "RESUME_ASSISTANT_TOGGLE") return;
    data.panel.hidden = !data.panel.hidden; save(); render();
  });

  load();
})();
