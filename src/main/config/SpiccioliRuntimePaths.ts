import path from 'node:path';
import type { App } from 'electron';
import { APP_CONFIG_FILE, LOGGING_CONFIG } from 'src/config/AppConfig';

/**
 * Where Spiccioli keeps what belongs to the installation rather than to a ledger: the preferences, the list of recently opened
 * files, and the operational log.
 *
 * The framework's own "RuntimePaths" is not used here. Its layout puts a database and a default backup folder inside the
 * user-data folder, and Spiccioli has neither: the ledger lives wherever the user put it and its backups live beside it, so
 * the two folders that layout resolves would be paths nothing ever writes to.
 */

export type SpiccioliRuntimePathsApp = Pick<App, 'getPath' | 'isPackaged'>;

export interface SpiccioliRuntimePaths {
	isDevelopment: boolean;
	rootDirectory: string;
	configFilePath: string;
	logDirectory: string;
}

// Development runs keep their own root folder inside the user-data folder, so a development session never touches the real preferences,
// the real recent-file list, or the real logs
export const resolveSpiccioliRuntimePaths = (app: SpiccioliRuntimePathsApp): SpiccioliRuntimePaths => {
	const isDevelopment = !app.isPackaged;
	const userDataDirectory = app.getPath('userData');
	const rootDirectory = isDevelopment ? path.join(userDataDirectory, APP_CONFIG_FILE.developmentDirectoryName) : userDataDirectory;

	return {
		isDevelopment,
		rootDirectory,
		configFilePath: path.join(rootDirectory, APP_CONFIG_FILE.fileName),
		logDirectory: path.join(rootDirectory, LOGGING_CONFIG.directoryName)
	};
};
