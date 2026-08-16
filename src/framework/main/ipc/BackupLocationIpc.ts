import type { BrowserWindow, Dialog, IpcMain, OpenDialogOptions } from 'electron';
import type { BackupLocationManager } from 'src/framework/main/config/BackupLocationManager';
import type { ChooseBackupDirectoryResult } from 'src/framework/types/BackupTypes';

type BackupLocationIpcMain = Pick<IpcMain, 'handle'>;

type BackupLocationDialog = Pick<Dialog, 'showOpenDialog'>;

export interface BackupLocationIpcChannels {
	getBackupLocation: string;
	chooseBackupDirectory: string;
	setBackupDirectory: string;
	setDefaultBackupDirectory: string;
}

// The native folder dialog names the application, so its wording is supplied instead of being fixed here
export interface BackupDirectoryDialogLabels {
	title: string;
	message: string;
	buttonLabel: string;
}

export interface RegisterBackupLocationIpcHandlersOptions {
	ipcMain: BackupLocationIpcMain;
	dialog: BackupLocationDialog;
	channels: BackupLocationIpcChannels;
	dialogLabels: BackupDirectoryDialogLabels;
	backupLocationManager: BackupLocationManager;
	getParentWindow?: () => BrowserWindow | undefined;
}

const createOpenDialogOptions = (dialogLabels: BackupDirectoryDialogLabels, defaultPath: string): OpenDialogOptions => {
	return {
		title: dialogLabels.title,
		message: dialogLabels.message,
		buttonLabel: dialogLabels.buttonLabel,
		defaultPath,
		properties: [ 'openDirectory', 'createDirectory' ]
	};
};

export const registerBackupLocationIpcHandlers = ({
	ipcMain,
	dialog,
	channels,
	dialogLabels,
	backupLocationManager,
	getParentWindow
}: RegisterBackupLocationIpcHandlersOptions): void => {
	const chooseBackupDirectory = async(): Promise<ChooseBackupDirectoryResult> => {
		const location = backupLocationManager.getLocation();
		const dialogOptions = createOpenDialogOptions(dialogLabels, location.directory || location.defaultDirectory);
		const parentWindow = getParentWindow?.();
		const dialogResult = await (parentWindow ? dialog.showOpenDialog(parentWindow, dialogOptions) : dialog.showOpenDialog(dialogOptions));
		const directory = dialogResult.filePaths[0];

		if(dialogResult.canceled || !directory) {
			return {
				ok: false,
				reason: 'cancelled'
			};
		}

		const validation = backupLocationManager.validateDirectory(directory);

		if(!validation.ok) {
			return {
				ok: false,
				reason: 'invalid-directory',
				message: validation.message
			};
		}

		return {
			ok: true,
			directory
		};
	};

	ipcMain.handle(channels.getBackupLocation, () => {
		return backupLocationManager.getLocation();
	});

	ipcMain.handle(channels.chooseBackupDirectory, () => {
		return chooseBackupDirectory();
	});

	ipcMain.handle(channels.setBackupDirectory, (_event, directory: string) => {
		return backupLocationManager.setBackupDirectory(directory);
	});

	ipcMain.handle(channels.setDefaultBackupDirectory, () => {
		return backupLocationManager.setDefaultBackupDirectory();
	});
};
