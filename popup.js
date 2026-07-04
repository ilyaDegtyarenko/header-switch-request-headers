const RULE_ID = 1;
const STORAGE_KEY = "headerInjectorState";
const ICON_PATHS = {
  active: {
    16: "icons/icon16-active.png",
    32: "icons/icon32-active.png",
    48: "icons/icon48-active.png",
    128: "icons/icon128-active.png"
  },
  inactive: {
    16: "icons/icon16-inactive.png",
    32: "icons/icon32-inactive.png",
    48: "icons/icon48-inactive.png",
    128: "icons/icon128-inactive.png"
  }
};
const RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "webtransport",
  "webbundle",
  "other"
];

const defaultState = {
  enabled: true,
  urlFilter: "",
  headers: []
};

const elements = {
  globalEnabled: document.querySelector("#globalEnabled"),
  urlFilter: document.querySelector("#urlFilter"),
  headersList: document.querySelector("#headersList"),
  addHeader: document.querySelector("#addHeader"),
  statusText: document.querySelector("#statusText")
};

let state = structuredClone(defaultState);
let saveTimer = null;

init();

async function init() {
  state = await loadState();
  render();
  bindEvents();
  await applyRules();
}

function bindEvents() {
  elements.globalEnabled.addEventListener("change", async () => {
    state.enabled = elements.globalEnabled.checked;
    render();
    await saveAndApply();
  });

  elements.urlFilter.addEventListener("input", () => {
    state.urlFilter = elements.urlFilter.value;
    scheduleSaveAndApply();
  });
  elements.urlFilter.addEventListener("change", saveAndApply);

  elements.addHeader.addEventListener("click", () => {
    state.headers.push({
      id: makeId(),
      enabled: true,
      operation: "set",
      name: "",
      value: ""
    });
    render();
    saveAndApply();
  });
}

async function loadState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const loaded = stored[STORAGE_KEY];
  if (!loaded || !Array.isArray(loaded.headers)) {
    return structuredClone(defaultState);
  }

  return {
    enabled: loaded.enabled !== false,
    urlFilter: typeof loaded.urlFilter === "string" ? loaded.urlFilter : "",
    headers: loaded.headers.map((header) => ({
      id: header.id || makeId(),
      enabled: header.enabled !== false,
      operation: header.operation === "remove" ? "remove" : "set",
      name: typeof header.name === "string" ? header.name : "",
      value: typeof header.value === "string" ? header.value : ""
    }))
  };
}

function render() {
  elements.globalEnabled.checked = state.enabled;
  elements.urlFilter.value = state.urlFilter;
  elements.headersList.replaceChildren();

  if (state.headers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "emptyState";
    empty.textContent = "No headers configured";
    elements.headersList.append(empty);
  }

  for (const header of state.headers) {
    elements.headersList.append(createHeaderRow(header));
  }

  updateStatus();
}

function createHeaderRow(header) {
  const row = document.createElement("div");
  row.className = "headerRow";
  row.classList.toggle("isRemove", header.operation === "remove");

  const enabledLabel = document.createElement("label");
  enabledLabel.className = "headerCheckbox";
  enabledLabel.title = "Enable or disable this header";

  const enabledInput = document.createElement("input");
  enabledInput.type = "checkbox";
  enabledInput.setAttribute("aria-label", "Enable or disable this header");
  enabledInput.checked = header.enabled;
  enabledInput.addEventListener("change", async () => {
    header.enabled = enabledInput.checked;
    updateStatus();
    await saveAndApply();
  });

  const enabledMark = document.createElement("span");
  enabledMark.append(createIcon("check"));
  enabledLabel.append(enabledInput, enabledMark);

  const operationSelect = document.createElement("select");
  operationSelect.className = "operationSelect";
  operationSelect.title = "Header operation";
  operationSelect.append(new Option("Set", "set"), new Option("Remove", "remove"));
  operationSelect.value = header.operation;
  operationSelect.addEventListener("change", async () => {
    header.operation = operationSelect.value;
    updateValueInputVisibility();
    await saveAndApply();
  });

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "nameInput";
  nameInput.placeholder = "Name";
  nameInput.value = header.name;
  nameInput.addEventListener("input", () => {
    header.name = nameInput.value;
    updateStatus();
    scheduleSaveAndApply();
  });
  nameInput.addEventListener("change", saveAndApply);

  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.className = "valueInput";
  valueInput.placeholder = "Value";
  valueInput.value = header.value;
  valueInput.addEventListener("input", () => {
    header.value = valueInput.value;
    scheduleSaveAndApply();
  });
  valueInput.addEventListener("change", saveAndApply);

  const deleteButton = document.createElement("button");
  deleteButton.className = "deleteButton";
  deleteButton.type = "button";
  deleteButton.title = "Delete row";
  deleteButton.setAttribute("aria-label", "Delete row");
  deleteButton.append(createIcon("trash"));
  deleteButton.addEventListener("click", async () => {
    state.headers = state.headers.filter((item) => item.id !== header.id);
    render();
    await saveAndApply();
  });

  updateValueInputVisibility();
  row.append(enabledLabel, operationSelect, nameInput, valueInput, deleteButton);
  return row;

  function updateValueInputVisibility() {
    const isRemove = header.operation === "remove";
    row.classList.toggle("isRemove", isRemove);
    valueInput.hidden = isRemove;
    valueInput.disabled = isRemove;
  }
}

async function saveAndApply() {
  state.urlFilter = elements.urlFilter.value.trim();
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  await applyRules();
}

function scheduleSaveAndApply() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveAndApply, 250);
}

async function applyRules() {
  try {
    const rule = buildRule();
    const options = { removeRuleIds: [RULE_ID] };
    if (rule) {
      options.addRules = [rule];
    }
    await chrome.declarativeNetRequest.updateDynamicRules(options);
    await updateActionIcon(Boolean(rule));
    setStatus(rule ? "Active" : "No active headers", false, Boolean(rule));
  } catch (error) {
    await updateActionIcon(false).catch(() => {});
    setStatus(error.message || String(error), true);
  }
}

function buildRule() {
  const requestHeaders = state.headers
    .filter((header) => header.enabled && header.name.trim())
    .map((header) => {
      const item = {
        header: header.name.trim(),
        operation: header.operation
      };
      if (header.operation === "set") {
        item.value = header.value;
      }
      return item;
    });

  if (!state.enabled || requestHeaders.length === 0) {
    return null;
  }

  const condition = {
    resourceTypes: RESOURCE_TYPES
  };
  if (state.urlFilter.trim()) {
    condition.urlFilter = state.urlFilter.trim();
  }

  return {
    id: RULE_ID,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders
    },
    condition
  };
}

function updateStatus() {
  const activeCount = state.enabled
    ? state.headers.filter((header) => header.enabled && header.name.trim()).length
    : 0;
  setStatus(`${activeCount} active header${activeCount === 1 ? "" : "s"}`, false, activeCount > 0);
}

function setStatus(message, isError = false, isActive = false) {
  elements.statusText.textContent = message;
  elements.statusText.classList.toggle("error", isError);
  elements.statusText.classList.toggle("active", !isError && isActive);
}

async function updateActionIcon(active) {
  if (!chrome.action?.setIcon) {
    return;
  }
  await chrome.action.setIcon({
    path: active ? ICON_PATHS.active : ICON_PATHS.inactive
  });
}

function makeId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");

  const paths = {
    check: [
      "m5 12 4 4 10-10"
    ],
    trash: [
      "M4 7h16",
      "M10 11v6",
      "M14 11v6",
      "M6 7l1 14h10l1-14",
      "M9 7V4h6v3"
    ]
  };

  for (const d of paths[name]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }

  return svg;
}
