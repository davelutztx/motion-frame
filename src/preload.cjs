'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('motionFrame', {
  choose: () => ipcRenderer.invoke('photo:choose'),
  drop: file => ipcRenderer.invoke('photo:load', webUtils.getPathForFile(file)),
  cancel: () => ipcRenderer.invoke('photo:cancel'),
  save: (id, index) => ipcRenderer.invoke('photo:save', id, index),
  reveal: () => ipcRenderer.invoke('photo:reveal'),
  onProgress: callback => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('photo:progress', listener);
    return () => ipcRenderer.removeListener('photo:progress', listener);
  }
});
