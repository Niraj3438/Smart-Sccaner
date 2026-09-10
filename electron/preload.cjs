const { contextBridge, ipcRenderer, webUtils } = require('electron');
const fs = require('fs');

function getWindowsDrives() {
  if (process.platform !== 'win32') return [];

  const drives = [];
  for (let code = 65; code <= 90; code++) {
    const root = `${String.fromCharCode(code)}:\\`;
    try {
      if (fs.existsSync(root)) drives.push(root);
    } catch {}
  }
  return drives;
}

function buildScanPayload(payload = {}) {
  const requested = Array.isArray(payload.locations)
    ? payload.locations.filter(Boolean)
    : [];

  // SmartScan's desktop mode is intentionally a one-file-to-system scan:
  // the user should not have to select a second folder. If no explicit
  // locations were supplied, search every mounted Windows drive.
  if (!requested.length && process.platform === 'win32') {
    const drives = getWindowsDrives();
    return {
      ...payload,
      locations: drives,
      autoSystemScan: true
    };
  }

  return {
    ...payload,
    locations: [...new Set(requested)],
    autoSystemScan: false
  };
}

contextBridge.exposeInMainWorld('smartscan', {
  // =========================
  // FILE / FOLDER
  // =========================

  selectFile: () =>
    ipcRenderer.invoke('select-file'),

  selectFolder: () =>
    ipcRenderer.invoke('select-folder'),

  scan: (payload = {}) =>
    ipcRenderer.invoke('scan', buildScanPayload(payload)),

  fileInfo: (filePath) =>
    ipcRenderer.invoke('file-info', filePath),

  openPath: (filePath) =>
    ipcRenderer.invoke('open-path', filePath),

  showFolder: (filePath) =>
    ipcRenderer.invoke('show-folder', filePath),

  renameFile: (filePath, newName) =>
    ipcRenderer.invoke('rename-file', { filePath, newName }),

  // =========================
  // LOCAL DATA
  // =========================

  loadData: () =>
    ipcRenderer.invoke('data-load'),

  saveData: (data) =>
    ipcRenderer.invoke('data-save', data),

  exportReport: (data) =>
    ipcRenderer.invoke('export-report', data),

  // =========================
  // APP
  // =========================

  installApp: () =>
    ipcRenderer.invoke('install-app'),

  recoveryScan: () =>
    ipcRenderer.invoke('recovery-scan'),

  // =========================
  // DRAG & DROP
  // =========================

  getDroppedPath: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return file?.path || '';
    }
  },

  // =========================
  // AUTH
  // =========================

  register: (payload) =>
    ipcRenderer.invoke('auth-register', payload),

  login: (payload) =>
    ipcRenderer.invoke('auth-login', payload),

  logout: () =>
    ipcRenderer.invoke('auth-logout'),

  resetPassword: (payload) =>
    ipcRenderer.invoke('auth-reset-password', payload),

  getSession: () =>
    ipcRenderer.invoke('auth-session'),

  exportAccount: () =>
    ipcRenderer.invoke('account-export'),

  importAccount: () =>
    ipcRenderer.invoke('account-import')
});