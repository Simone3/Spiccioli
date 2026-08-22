import type { App, IpcMain } from 'electron';
import type { SpiccioliAppInfo } from 'src/types/AppInfoTypes';
import { SPICCIOLI_APP_INFO_IPC_CHANNELS } from 'src/types/AppInfoIpcChannels';

export { SPICCIOLI_APP_INFO_IPC_CHANNELS } from 'src/types/AppInfoIpcChannels';

type AppInfoIpcMain = Pick<IpcMain, 'handle'>;

type AppInfoApp = Pick<App, 'getVersion'>;

export interface RegisterAppInfoIpcHandlersOptions {
	ipcMain: AppInfoIpcMain;
	app: AppInfoApp;
	platform: string;

	// Resolved once at startup, with the rest of the runtime paths, and never derived here
	logDirectory: string;
}

// Answers the renderer's question of which build it is part of. The version is read from Electron rather than from "package.json"
// directly, so that it is the one the running application actually reports, whether it was started from the repository or from an
// installed copy, and it is read again on every request rather than captured once.
export const registerAppInfoIpcHandlers = ({ ipcMain, app, platform, logDirectory }: RegisterAppInfoIpcHandlersOptions): void => {
	ipcMain.handle(SPICCIOLI_APP_INFO_IPC_CHANNELS.getAppInfo, (): SpiccioliAppInfo => {
		return {
			version: app.getVersion(),
			platform,
			logDirectory
		};
	});
};
