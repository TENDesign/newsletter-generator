const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("harborPressDesktop", {
  loadIssues: () => ipcRenderer.invoke("storage:load-issues"),
  saveIssues: (issues) => ipcRenderer.invoke("storage:save-issues", issues),
  getDataDirectory: () => ipcRenderer.invoke("storage:get-directory"),
  openDataDirectory: () => ipcRenderer.invoke("storage:open-directory"),
  generatePdf: (suggestedName) => ipcRenderer.invoke("pdf:generate", suggestedName),
});
