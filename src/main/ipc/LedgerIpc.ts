import { existsSync } from 'node:fs';
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

type LedgerDialog = Pick<Dialog, 'showOpenDialog' | 'showSaveDialog' | 'showMessageBox'>;

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

	// Called when the renderer cannot answer a shutdown yet, because it is asking the user what to do about changes that never
	// reached the file. The close is still on; only the wait is held off.
	onClosePaused: () => void;

	// The ledger a launch handed over, if one is still waiting. Taking it is what clears it, so the renderer asking on mount and
	// the renderer answering the event cannot both be given the same file.
	takeFileWaitingToOpen: () => string | undefined;

	// Whether a file is already at a path. Injected so that the overwrite check is testable without a filesystem.
	fileExists?: (filePath: string) => boolean;

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
	onClosePaused,
	onPreferencesChanged,
	takeFileWaitingToOpen,
	fileExists = existsSync
}: RegisterLedgerIpcHandlersOptions): void => {
	const fileFilters = [ {
		name: translator.t('storage.fileTypeName'),
		extensions: [ LEDGER_EXTENSION_WITHOUT_DOT ]
	} ];

	// The other way a file is chosen, and the one nobody in the window asked for: a launch handed it over and the renderer is
	// coming to collect it. It answers once, because taking it is what clears it.
	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.takeFileWaitingToOpen, (): string | undefined => {
		return takeFileWaitingToOpen();
	});

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

	/**
	 * Asks the save dialog's own question about a file the save dialog never saw.
	 *
	 * The dialog checks for an existing file under the name that was typed, and the extension goes on **after** it has answered
	 * — so typing "finances" beside a "finances.spiccioli" gets no warning from anybody, and what is created there lands on a
	 * ledger the user still has. This is that warning, asked only where the dialog could not have asked it.
	 * @param filePath The path the extension has already been put back on.
	 * @returns Whether the file may be created there.
	 */
	const confirmOverwrite = async(filePath: string): Promise<boolean> => {
		const window = getWindow();
		const options = {
			type: 'warning' as const,
			buttons: [ translator.t('storage.overwriteReplace'), translator.t('storage.overwriteCancel') ],
			defaultId: 1,
			cancelId: 1,
			title: translator.t('storage.overwriteTitle'),
			message: translator.t('storage.overwriteMessage', { name: path.basename(filePath) }),
			detail: translator.t('storage.overwriteDetail')
		};
		const answer = await (window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options));

		return answer.response === 0;
	};

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

		const filePath = withLedgerExtension(result.filePath);

		// Only where the name changed: everywhere else the dialog has already asked, and asking twice for one file is worse
		// than not asking at all
		if(filePath !== result.filePath && fileExists(filePath) && !await confirmOverwrite(filePath)) {
			return { cancelled: true };
		}

		return {
			cancelled: false,
			filePath
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

	ipcMain.handle(SPICCIOLI_LEDGER_IPC_CHANNELS.pauseClose, () => {
		onClosePaused();
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
