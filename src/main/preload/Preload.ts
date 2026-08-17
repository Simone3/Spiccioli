import { contextBridge, ipcRenderer } from 'electron';
import { subscribeToChannel } from 'src/framework/preload/IpcBridge';
import { SPICCIOLI_APP_INFO_IPC_CHANNELS } from 'src/types/AppInfoIpcChannels';
import { SPICCIOLI_DIAGNOSTICS_IPC_CHANNELS, SPICCIOLI_LEDGER_IPC_CHANNELS, SPICCIOLI_LEDGER_IPC_EVENTS } from 'src/types/LedgerIpcChannels';
import type { SpiccioliAppInfoApi } from 'src/types/AppInfoTypes';
import type { SpiccioliDiagnosticsApi, SpiccioliLedgerApi } from 'src/types/LedgerIpcTypes';

const spiccioliAppInfo: SpiccioliAppInfoApi = {
	getAppInfo: () => {
		return ipcRenderer.invoke(SPICCIOLI_APP_INFO_IPC_CHANNELS.getAppInfo);
	}
};

// Functions rather than handles, and one function per thing the renderer is allowed to ask for. Nothing here exposes a module,
// a path or an Electron object that the page could reach past.
const spiccioliLedger: SpiccioliLedgerApi = {
	chooseFileToOpen: () => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.chooseFileToOpen);
	},
	chooseFileToCreate: () => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.chooseFileToCreate);
	},
	readFile: (filePath) => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.readFile, filePath);
	},
	acceptFile: (request) => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.acceptFile, request);
	},
	rejectFile: (request) => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.rejectFile, request);
	},
	createFile: (request) => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.createFile, request);
	},
	save: (contents) => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.save, contents);
	},
	writePreUpgradeBackup: () => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.writePreUpgradeBackup);
	},
	completeUpgrade: (request) => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.completeUpgrade, request);
	},
	closeSession: (request) => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.closeSession, request);
	},
	getRecentFiles: () => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.getRecentFiles);
	},
	dismissRecentFile: (filePath) => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.dismissRecentFile, filePath);
	},
	getPreferences: () => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.getPreferences);
	},
	setPreferences: (preferences) => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.setPreferences, preferences);
	},
	onWriteAttemptFailed: (listener) => {
		return subscribeToChannel(ipcRenderer, SPICCIOLI_LEDGER_IPC_EVENTS.writeAttemptFailed, listener);
	},
	onExternalModification: (listener) => {
		return subscribeToChannel(ipcRenderer, SPICCIOLI_LEDGER_IPC_EVENTS.externalModification, listener);
	},
	onMenuCommand: (listener) => {
		return subscribeToChannel(ipcRenderer, SPICCIOLI_LEDGER_IPC_EVENTS.menuCommand, listener);
	},
	onPrepareForClose: (listener) => {
		return subscribeToChannel(ipcRenderer, SPICCIOLI_LEDGER_IPC_EVENTS.prepareForClose, listener);
	}
};

const spiccioliDiagnostics: SpiccioliDiagnosticsApi = {
	reportRenderError: (report) => {
		return ipcRenderer.invoke(SPICCIOLI_DIAGNOSTICS_IPC_CHANNELS.reportRenderError, report);
	}
};

contextBridge.exposeInMainWorld('spiccioliAppInfo', spiccioliAppInfo);
contextBridge.exposeInMainWorld('spiccioliLedger', spiccioliLedger);
contextBridge.exposeInMainWorld('spiccioliDiagnostics', spiccioliDiagnostics);
