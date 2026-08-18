import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { LOGGING_CONFIG, SHUTDOWN_CONFIG, STORAGE_CONFIG, WINDOW_CONFIG } from 'src/config/AppConfig';
import { appLogger, initializeAppLogger } from 'src/framework/main/logging/AppLogger';
import { installProcessCrashHandlers } from 'src/framework/main/logging/ProcessCrashHandlers';
import { installWindowNavigationGuard } from 'src/framework/main/window/WindowNavigationGuard';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';
import { createSpiccioliTranslator, resolveSpiccioliLanguage, type SpiccioliTranslator } from 'src/i18n/Translations';
import { createSpiccioliConfigStore, type SpiccioliConfigStore } from 'src/main/config/SpiccioliConfigStore';
import { resolveSpiccioliRuntimePaths } from 'src/main/config/SpiccioliRuntimePaths';
import { logStartupConfiguration } from 'src/main/config/StartupConfigurationLog';
import { registerAppInfoIpcHandlers } from 'src/main/ipc/AppInfoIpc';
import { registerDiagnosticsIpcHandlers } from 'src/main/ipc/DiagnosticsIpc';
import { registerLedgerIpcHandlers } from 'src/main/ipc/LedgerIpc';
import { registerPricesIpcHandlers } from 'src/main/ipc/PricesIpc';
import { buildAppMenuTemplate } from 'src/main/menu/AppMenu';
import { createYahooPriceProvider } from 'src/main/prices/YahooPriceProvider';
import { createLedgerSession, type LedgerSession } from 'src/main/storage/LedgerSession';
import { isDevelopmentRun, resolveWindowLoadTarget, type WindowLoadTarget } from 'src/main/window/WindowLoadTarget';
import { SPICCIOLI_LEDGER_IPC_EVENTS } from 'src/types/LedgerIpcChannels';
import type { LedgerCloseDoor, LedgerMenuCommand } from 'src/types/LedgerIpcTypes';

let mainWindow: BrowserWindow | undefined;

// Only the first failure opens a dialog. A process that started failing usually keeps failing, and a stack of error boxes would
// bury the window instead of reporting anything the first one did not already say.
let hasReportedFatalError = false;

// Set as soon as the application knows which language to speak, so that a failure after that point can be worded for the user
let fatalErrorTranslator: SpiccioliTranslator | undefined;

// The renderer is the side that has to finish saving before the file can stop being the open one, so a quit asks it to and waits.
// Once it has answered, or the wait has run out, the quit is let through.
let isShuttingDown = false;

// What the wait is made of, kept so that a renderer holding something unwritten can call the whole shutdown off
let shutdownTimers: { quitAnyway: ReturnType<typeof setTimeout>; waitForRenderer: ReturnType<typeof setInterval> } | undefined;

/**
 * Tells the user about a failure that reached the top of the main process.
 * The log always has it by the time this runs, so this only decides whether there is anything worth putting in front of the user.
 * @param message The failure, as a message.
 */
const reportFatalErrorToUser = (message: string): void => {
	// A failure before the language is resolved is a failure to start at all: there is no window and no wording, and the log file
	// is the only place it can be reported from
	if(hasReportedFatalError || !fatalErrorTranslator) {
		return;
	}

	hasReportedFatalError = true;

	dialog.showErrorBox(
		fatalErrorTranslator.t('crash.mainProcessTitle'),
		fatalErrorTranslator.t('crash.mainProcessMessage', { message })
	);
};

// The window is only ever allowed on the page the main process loaded into it, which the guard needs as a URL
const getAllowedNavigationUrl = (loadTarget: WindowLoadTarget): string => {
	return loadTarget.type === 'url' ? loadTarget.value : pathToFileURL(loadTarget.value).href;
};

// The window title is where the current file is named, and it carries the file's name and nothing else
const setWindowTitleForFile = (translator: SpiccioliTranslator, filePath: string | undefined): void => {
	if(!mainWindow) {
		return;
	}

	mainWindow.setTitle(filePath ?
		translator.t('window.titleWithFile', {
			name: path.basename(filePath, path.extname(filePath)),
			app: translator.t('app.name')
		}) :
		translator.t('app.name'));
};

const sendToRenderer = (channel: string, payload: unknown): void => {
	mainWindow?.webContents.send(channel, payload);
};

// Rebuilt rather than patched, because Open Recent changes every time a file is opened and Electron has no way to replace one submenu
const installApplicationMenu = (translator: SpiccioliTranslator, configStore: SpiccioliConfigStore): void => {
	Menu.setApplicationMenu(Menu.buildFromTemplate(buildAppMenuTemplate({
		translator,
		isMac: process.platform === 'darwin',
		recentFiles: configStore.readRecentFiles(),
		onCommand: (command: LedgerMenuCommand) => {
			sendToRenderer(SPICCIOLI_LEDGER_IPC_EVENTS.menuCommand, command);
		},
		onAbout: () => {
			void dialog.showMessageBox({
				type: 'info',
				title: translator.t('menu.about', { name: translator.t('app.name') }),
				message: translator.t('app.name'),
				detail: translator.t('menu.aboutVersion', { version: app.getVersion() })
			});
		},
		onQuit: () => {
			app.quit();
		}
	})));
};

/**
 * Asks the renderer to finish what it is doing and close the session, then lets the quit through.
 * The wait is bounded: a renderer that cannot answer must not be able to stop the application from exiting, and what would be
 * lost by quitting anyway is a copy of a file that is already safely on disk.
 * @param session The open session, which is what knows when there is nothing left to write.
 * @param door Which of the four doors the session is leaving by.
 */
const beginShutdown = (session: LedgerSession, door: LedgerCloseDoor): void => {
	isShuttingDown = true;
	sendToRenderer(SPICCIOLI_LEDGER_IPC_EVENTS.prepareForClose, door);

	const quitAnyway = setTimeout(() => {
		appLogger.warn('The renderer did not finish closing in time, quitting anyway', {
			type: 'ledger.closed',
			door,
			reason: 'timed-out'
		});
		app.quit();
	}, SHUTDOWN_CONFIG.prepareForCloseTimeoutMs);

	// The renderer answers by closing the session, and the session is what knows when there is nothing left to write
	const waitForRenderer = setInterval(() => {
		if(session.getOpenFilePath() === undefined) {
			clearInterval(waitForRenderer);
			clearTimeout(quitAnyway);
			app.quit();
		}
	}, SHUTDOWN_CONFIG.pollIntervalMs);

	shutdownTimers = { quitAnyway, waitForRenderer };
};

/**
 * Calls a shutdown off, which is the renderer's other answer: something on screen has not been written and the user chose to
 * stay with it rather than lose it. The quit that was asked for is abandoned and asking for one again starts it over.
 */
const cancelShutdown = (): void => {
	if(shutdownTimers) {
		clearTimeout(shutdownTimers.quitAnyway);
		clearInterval(shutdownTimers.waitForRenderer);
		shutdownTimers = undefined;
	}

	isShuttingDown = false;
};

// What the window loads, resolved once at startup so that every window of this run loads the same page
const createWindow = (loadTarget: WindowLoadTarget, translator: SpiccioliTranslator): void => {
	const win = new BrowserWindow({
		width: WINDOW_CONFIG.widthPixels,
		height: WINDOW_CONFIG.heightPixels,
		show: false,
		title: translator.t('app.name'),
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, WINDOW_CONFIG.preloadScriptFileName)
		}
	});

	// Maximizes to the screen work area on startup without engaging macOS native fullscreen (a distinct window state the user opts into separately)
	win.once('ready-to-show', () => {
		win.maximize();
		win.show();
	});

	// The renderer's Content-Security-Policy says what the page may load, not where it may go. Without this, a link or a script
	// could navigate the window onto a page of its own, and that page would sit behind the preload bridge.
	installWindowNavigationGuard({
		webContents: win.webContents,
		allowedUrl: getAllowedNavigationUrl(loadTarget),
		onNavigationBlocked: (url) => {
			appLogger.warn('Blocked a navigation away from the Spiccioli window', {
				type: 'blocked-navigation',
				url
			});
		}
	});

	mainWindow = win;

	win.on('closed', () => {
		if(mainWindow === win) {
			mainWindow = undefined;
		}
	});

	if(loadTarget.type === 'url') {
		void win.loadURL(loadTarget.value);
	}
	else {
		void win.loadFile(loadTarget.value);
	}
};

const startApplication = (): void => {
	// Installed before anything can fail. An exception that reaches the top of the process, or a promise nobody handled, would
	// otherwise leave nothing behind at all: the startup below runs inside a promise, so a throw in it would take the window with
	// it without a word anywhere.
	installProcessCrashHandlers({
		process,
		onFatalError: ({ message }) => {
			reportFatalErrorToUser(message);
		}
	});

	const startup = app.whenReady().then(() => {
		// Resolved first, so that every failure from here on has wording to report itself with. The main process words the native
		// dialogs and the failures it reports back to the renderer, so it resolves the language from the operating system the same
		// way the renderer resolves it from the browser.
		const requestedLocale = app.getLocale();
		const language = resolveSpiccioliLanguage([ requestedLocale ]);
		const translator = createSpiccioliTranslator(language);
		fatalErrorTranslator = translator;

		// Resolved before the window, because every window of this run loads the same page
		const loadTarget = resolveWindowLoadTarget({
			appRootDirectory: app.getAppPath(),
			isPackaged: app.isPackaged
		});

		const runtimePaths = resolveSpiccioliRuntimePaths(app);

		initializeAppLogger({
			logDirectory: runtimePaths.logDirectory,
			fileName: LOGGING_CONFIG.fileName,
			maximumFileSizeBytes: LOGGING_CONFIG.maximumFileSizeBytes,
			retainedArchiveCount: LOGGING_CONFIG.retainedArchiveCount
		});

		const configStore = createSpiccioliConfigStore({ configFilePath: runtimePaths.configFilePath });

		logStartupConfiguration({
			version: app.getVersion(),
			isDevelopment: runtimePaths.isDevelopment,
			platform: process.platform,
			architecture: process.arch,
			electronVersion: process.versions.electron,
			chromeVersion: process.versions.chrome,
			nodeVersion: process.versions.node,
			requestedLocale,
			resolvedLanguage: language,
			rendererSource: isDevelopmentRun(loadTarget) ? 'development-server' : 'build',
			rendererLocation: loadTarget.value,
			rootDirectory: runtimePaths.rootDirectory,
			configFilePath: runtimePaths.configFilePath,
			logFilePath: path.join(runtimePaths.logDirectory, LOGGING_CONFIG.fileName),
			autosaveDebounceMs: STORAGE_CONFIG.autosaveDebounceMs,
			maximumWriteAttempts: STORAGE_CONFIG.maximumWriteAttempts,
			writeRetryDelayMs: STORAGE_CONFIG.writeRetryDelayMs,
			writeTimeoutMs: STORAGE_CONFIG.writeTimeoutMs,
			backupCount: configStore.readPreferences().backupCount,
			logMaximumFileSizeBytes: LOGGING_CONFIG.maximumFileSizeBytes,
			logRetainedArchiveCount: LOGGING_CONFIG.retainedArchiveCount
		});

		const session = createLedgerSession({
			translator,
			readBackupCount: () => {
				return configStore.readPreferences().backupCount;
			},
			rememberRecentFile: (filePath) => {
				configStore.rememberRecentFile(filePath);
				installApplicationMenu(translator, configStore);
			},
			onWriteAttemptFailed: (event) => {
				sendToRenderer(SPICCIOLI_LEDGER_IPC_EVENTS.writeAttemptFailed, event);
			},
			onExternalModification: (event) => {
				sendToRenderer(SPICCIOLI_LEDGER_IPC_EVENTS.externalModification, event);
			}
		});

		registerAppInfoIpcHandlers({
			ipcMain,
			app,
			platform: process.platform
		});
		registerDiagnosticsIpcHandlers({ ipcMain });

		// The only thing in the application that touches the network, and it is here rather than in the renderer because the
		// renderer is where the ledger is. It is reached by one press of a button and never on load, on a timer or in the background.
		registerPricesIpcHandlers({
			ipcMain,
			provider: createYahooPriceProvider({ fetchResource: fetch })
		});
		registerLedgerIpcHandlers({
			ipcMain,
			dialog,
			session,
			configStore,
			translator,
			getWindow: () => {
				return mainWindow;
			},
			onOpenFileChanged: (filePath) => {
				setWindowTitleForFile(translator, filePath);
				installApplicationMenu(translator, configStore);
			},
			onCloseCancelled: cancelShutdown
		});

		installApplicationMenu(translator, configStore);
		createWindow(loadTarget, translator);

		// Closing the window is a close of the session on every platform, and on some of them it is not a quit. Either way the
		// renderer is asked to finish first, so the closing copy is taken with everything already written.
		app.on('before-quit', (event) => {
			if(!isShuttingDown && session.getOpenFilePath() !== undefined) {
				event.preventDefault();
				beginShutdown(session, 'quit');
			}
		});

		app.on('activate', () => {
			if(BrowserWindow.getAllWindows().length === 0) {
				createWindow(loadTarget, translator);
			}
		});
	});

	// Startup runs to the point where the window exists, so anything that throws before that leaves no window and no way to try
	// again. It is reported and the application is quit, rather than left running with nothing on screen.
	void startup.catch((error: unknown) => {
		const message = getErrorMessage(error);

		appLogger.error(message, {
			type: 'startup-failed',
			stack: error instanceof Error ? error.stack : undefined
		});
		reportFatalErrorToUser(message);
		app.quit();
	});

	app.on('window-all-closed', () => {
		if(process.platform !== 'darwin') {
			app.quit();
		}
	});
};

// The Windows installer runs Spiccioli itself to set up and tear down its shortcuts, passing the step as a command line argument. Those
// runs are the installer's, not the user's: "electron-squirrel-startup" does that step and reports that it did, and Spiccioli then quits
// instead of opening a window nobody asked for in the middle of an install, an update or an uninstall. It is false on every other
// platform and on every normal launch.
if(squirrelStartup) {
	app.quit();
}
else {
	startApplication();
}
