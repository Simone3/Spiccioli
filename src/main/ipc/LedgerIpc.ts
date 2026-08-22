import path from 'node:path';
import type { BrowserWindow, Dialog, IpcMain } from 'electron';
import { LEDGER_FILE_CONFIG } from 'src/config/AppConfig';
import { SPICCIOLI_LEDGER_IPC_CHANNELS } from 'src/types/LedgerIpcChannels';
import type { SpiccioliTranslator } from 'src/i18n/Translations';
import type { SpiccioliConfigStore } from 'src/main/config/SpiccioliConfigStore';
import type { LedgerSession } from 'src/main/storage/LedgerSession';
import type {
	AcceptLedgerFileRequest,
	ChooseLedgerFileResult,
	CloseLedgerSessionRequest,
	CreateLedgerFileRequest,
	RejectLedgerFileRequest,
	UpgradeLedgerRequest
} from 'src/types/LedgerIpcTypes';
import type { Preferences } from 'src/types/PreferencesTypes';

/**
 * The renderer's way to the file.
 *
 * Every channel here is a request the renderer makes and the main process answers, and every one of them carries text and paths
 * rather than a parsed document: the model lives in the renderer and the file lives here, and neither side learns the other's job.
 * The two dialogs are the only places the operating system's own file chooser is opened.
 */

type LedgerIpcMain = Pick<IpcMain, 'handle'>;

type LedgerDialog = Pick<Dialog, 'showOpenDialog' | 'showSaveDialog'>;

export interface RegisterLedgerIpcHandlersOptions {
	ipcMain: LedgerIpcMain;
	dialog: LedgerDialog;
	session: LedgerSession;
	configStore: SpiccioliConfigStore;
	translator: SpiccioliTranslator;

	// The window the dialogs are attached to, so that they open as sheets rather than as separate windows
	getWindow: () => BrowserWindow | undefined;

	// Called whenever the open file changes, so that the window title follows it
	onOpenFileChanged: (filePath: string | undefined) => void;

	// Called when the renderer answers a shutdown with a refusal, which is the user choosing to stay with something unwritten
	onCloseCancelled: () => void;

	// Called once the preferences have been written, so that the ones the main process acts on rather than reads follow a change
	// immediately: the level the log is kept at is the only one of them so far
	onPreferencesChanged: (preferences: Preferences) => void;
}

const LEDGER_EXTENSION_WITHOUT_DOT = LEDGER_FILE_CONFIG.extension.replace(/^\./, '');

// The save dialog does not guarantee the extension on every platform, so the one the ledger has to carry is put back on here
const withLedgerExtension = (filePath: string): string => {
	return path.extname(filePath).toLowerCase() === LEDGER_FILE_CONFIG.extension ? filePath : `${filePath}${LEDGER_FILE_CONFIG.extension}`;
};

export const registerLedgerIpcHandlers = ({
	ipcMain,
	dialog,
	session,
	configStore,
	translator,
	getWindow,
	onOpenFileChanged,
	onCloseCancelled,
	onPreferencesChanged
}: RegisterLedgerIpcHandlersOptions): void => {
	const fileFilters = [ {
		name: translator.t('storage.fileTypeName'),
		extensions: [ LEDGER_EXTENSION_WITHOUT_DOT ]
	} ];

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.chooseFileToOpen, async(): Promise<ChooseLedgerFileResult> => {
		const window = getWindow();
		const options = {
			title: translator.t('storage.openDialogTitle'),
			properties: [ 'openFile' as const ],
			filters: fileFilters
		};
		const result = await (window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options));

		if(result.canceled || result.filePaths.length === 0) {
			return { cancelled: true };
		}

		return {
			cancelled: false,
			filePath: result.filePaths[0]
		};
	});

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.chooseFileToCreate, async(): Promise<ChooseLedgerFileResult> => {
		const window = getWindow();
		const options = {
			title: translator.t('storage.newDialogTitle'),
			defaultPath: `${translator.t('storage.newFileDefaultName')}${LEDGER_FILE_CONFIG.extension}`,
			filters: fileFilters
		};
		const result = await (window ? dialog.showSaveDialog(window, options) : dialog.showSaveDialog(options));

		if(result.canceled || !result.filePath) {
			return { cancelled: true };
		}

		return {
			cancelled: false,
			filePath: withLedgerExtension(result.filePath)
		};
	});

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.readFile, (_event, filePath: string) => {
		return session.readFile(filePath);
	});

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.acceptFile, (_event, request: AcceptLedgerFileRequest) => {
		session.acceptFile(request);
		onOpenFileChanged(request.filePath);
	});

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.rejectFile, (_event, request: RejectLedgerFileRequest) => {
		session.rejectFile(request);
	});

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.createFile, async(_event, request: CreateLedgerFileRequest) => {
		const result = await session.createFile(request);

		onOpenFileChanged(session.getOpenFilePath());

		return result;
	});

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.save, (_event, contents: string) => {
		return session.save(contents);
	});

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.writePreUpgradeBackup, () => {
		return session.writePreUpgradeBackup();
	});

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.completeUpgrade, async(_event, request: UpgradeLedgerRequest) => {
		const result = await session.completeUpgrade(request);

		onOpenFileChanged(session.getOpenFilePath());

		return result;
	});

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.closeSession, async(_event, request: CloseLedgerSessionRequest) => {
		const result = await session.closeSession(request.door);

		onOpenFileChanged(undefined);

		return result;
	});

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.cancelClose, () => {
		onCloseCancelled();
	});

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.getBackupDirectory, () => {
		return session.getBackupDirectory();
	});

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.getRecentFiles, () => {
		return configStore.readRecentFiles();
	});

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.dismissRecentFile, (_event, filePath: string) => {
		return configStore.dismissRecentFile(filePath);
	});

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.getPreferences, () => {
		return configStore.readPreferences();
	});

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.setPreferences, (_event, preferences: Preferences) => {
		configStore.writePreferences(preferences);
		onPreferencesChanged(preferences);
	});
};
