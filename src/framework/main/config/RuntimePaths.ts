import path from 'node:path';
import type { App } from 'electron';

export type RuntimePathsApp = Pick<App, 'getPath' | 'isPackaged'>;

// The folder and file names the application wants inside its user-data folder
export interface RuntimePathsLayout {
	developmentDirectoryName: string;
	configFileName: string;
	logDirectoryName: string;
	databaseDirectoryName: string;
	databaseFileName: string;
	backupDirectoryName: string;
}

export interface RuntimePaths {
	isDevelopment: boolean;
	rootDirectory: string;
	configFilePath: string;
	logDirectory: string;
	databaseDirectory: string;
	databasePath: string;
	defaultBackupDirectory: string;
}

// Development runs keep their own root folder inside the user-data folder, so a development session never touches the real configuration, logs, database, or backups
export const resolveRuntimePaths = (app: RuntimePathsApp, layout: RuntimePathsLayout): RuntimePaths => {
	const isDevelopment = !app.isPackaged;
	const userDataDirectory = app.getPath('userData');
	const rootDirectory = isDevelopment ? path.join(userDataDirectory, layout.developmentDirectoryName) : userDataDirectory;
	const databaseDirectory = path.join(rootDirectory, layout.databaseDirectoryName);

	return {
		isDevelopment,
		rootDirectory,
		configFilePath: path.join(rootDirectory, layout.configFileName),
		logDirectory: path.join(rootDirectory, layout.logDirectoryName),
		databaseDirectory,
		databasePath: path.join(databaseDirectory, layout.databaseFileName),
		defaultBackupDirectory: path.join(rootDirectory, layout.backupDirectoryName)
	};
};
