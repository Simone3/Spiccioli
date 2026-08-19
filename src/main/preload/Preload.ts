import { contextBridge, ipcRenderer } from 'electron';
import { subscribeToChannel } from 'src/framework/preload/IpcBridge';
import { SPICCIOLI_APP_INFO_IPC_CHANNELS } from 'src/types/AppInfoIpcChannels';
import { SPICCIOLI_APP_MENU_IPC_CHANNELS, SPICCIOLI_APP_MENU_IPC_EVENTS } from 'src/types/AppMenuIpcChannels';
import { SPICCIOLI_DIAGNOSTICS_IPC_CHANNELS, SPICCIOLI_LEDGER_IPC_CHANNELS, SPICCIOLI_LEDGER_IPC_EVENTS } from 'src/types/LedgerIpcChannels';
import { SPICCIOLI_PRICES_IPC_CHANNELS } from 'src/types/PriceIpcChannels';
import type { SpiccioliAppInfoApi } from 'src/types/AppInfoTypes';
import type { SpiccioliAppMenuApi } from 'src/types/AppMenuTypes';
import type { SpiccioliDiagnosticsApi, SpiccioliLedgerApi } from 'src/types/LedgerIpcTypes';
import type { PricePassProgress, SpiccioliPricesApi } from 'src/types/PriceIpcTypes';

const spiccioliAppInfo: SpiccioliAppInfoApi = {
	getAppInfo: () => {
		return ipcRenderer.invoke(SPICCIOLI_APP_INFO_IPC_CHANNELS.getAppInfo);
	}
};

// The menu bar the renderer draws where the native one is hidden. What crosses is a description on the way out and one of a closed
// set of command names on the way back, so nothing in the window can ask for anything the menu does not already offer.
const spiccioliAppMenu: SpiccioliAppMenuApi = {
	getMenuBar: () => {
		return ipcRenderer.invoke(SPICCIOLI_APP_MENU_IPC_CHANNELS.getMenuBar);
	},
	runMenuCommand: (request) => {
		return ipcRenderer.invoke(SPICCIOLI_APP_MENU_IPC_CHANNELS.runMenuCommand, request);
	},
	onMenuBarChanged: (listener) => {
		return subscribeToChannel(ipcRenderer, SPICCIOLI_APP_MENU_IPC_EVENTS.menuBarChanged, listener);
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
	cancelClose: () => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.cancelClose);
	},
	getBackupDirectory: () => {
		return ipcRenderer.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.getBackupDirectory);
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

// The one thing in the application that reaches the network, and it reaches it from the other side of this bridge: the renderer
// hands over a listing per security and is handed a quote or a reason back, and never a socket of its own
const spiccioliPrices: SpiccioliPricesApi = {
	updatePrices: (listings) => {
		return ipcRenderer.invoke(SPICCIOLI_PRICES_IPC_CHANNELS.updatePrices, listings);
	},
	reportPricesWritten: (report) => {
		return ipcRenderer.invoke(SPICCIOLI_PRICES_IPC_CHANNELS.reportPricesWritten, report);
	},

	// The listener is handed the progress and never the event it arrived on: nothing of Electron's crosses the bridge. What comes
	// back removes it again, so a pass leaves no listener behind it.
	onPassProgress: (listener) => {
		const handler = (_event: unknown, progress: PricePassProgress): void => {
			listener(progress);
		};

		ipcRenderer.on(SPICCIOLI_PRICES_IPC_CHANNELS.passProgress, handler);

		return () => {
			ipcRenderer.removeListener(SPICCIOLI_PRICES_IPC_CHANNELS.passProgress, handler);
		};
	}
};

const spiccioliDiagnostics: SpiccioliDiagnosticsApi = {
	reportRenderError: (report) => {
		return ipcRenderer.invoke(SPICCIOLI_DIAGNOSTICS_IPC_CHANNELS.reportRenderError, report);
	}
};

contextBridge.exposeInMainWorld('spiccioliAppInfo', spiccioliAppInfo);
contextBridge.exposeInMainWorld('spiccioliAppMenu', spiccioliAppMenu);
contextBridge.exposeInMainWorld('spiccioliLedger', spiccioliLedger);
contextBridge.exposeInMainWorld('spiccioliPrices', spiccioliPrices);
contextBridge.exposeInMainWorld('spiccioliDiagnostics', spiccioliDiagnostics);
