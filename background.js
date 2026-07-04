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

chrome.runtime.onInstalled.addListener(updateIconFromStorage);
chrome.runtime.onStartup.addListener(updateIconFromStorage);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    updateIcon(changes[STORAGE_KEY].newValue);
  }
});

async function updateIconFromStorage() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  await updateIcon(stored[STORAGE_KEY]);
}

async function updateIcon(state) {
  const active = Boolean(
    state?.enabled !== false &&
      Array.isArray(state?.headers) &&
      state.headers.some((header) => header.enabled !== false && String(header.name || "").trim())
  );

  await chrome.action.setIcon({
    path: active ? ICON_PATHS.active : ICON_PATHS.inactive
  });
}
