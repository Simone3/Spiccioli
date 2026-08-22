import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, Menu, type BrowserWindowConstructorOptions } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { LOGGING_CONFIG, SHUTDOWN_CONFIG, STORAGE_CONFIG, TITLE_BAR_CONFIG, WINDOW_CONFIG } from 'src/config/AppConfig';
import { appLogger, initializeAppLogger } from 'src/framework/main/logging/AppLogger';
import { installProcessCrashHandlers } from 'src/framework/main/logging/ProcessCrashHandlers';
import { installWindowNavigationGuard } from 'src/framework/main/window/WindowNavigationGuard';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';
import { createSpiccioliTranslator, resolveSpiccioliLanguage, type SpiccioliTranslator } from 'src/i18n/Translations';
import { createSpiccioliConfigStore, type SpiccioliConfigStore } from 'src/main/config/SpiccioliConfigStore';
import { resolveSpiccioliRuntimePaths } from 'src/main/config/SpiccioliRuntimePaths';
import { logStartupConfiguration } from 'src/main/config/StartupConfigurationLog';
import { registerAppInfoIpcHandlers } from 'src/main/ipc/AppInfoIpc';
import { registerAppMenuIpcHandlers } from 'src/main/ipc/AppMenuIpc';
import { registerDiagnosticsIpcHandlers } from 'src/main/ipc/DiagnosticsIpc';
import { registerLedgerIpcHandlers } from 'src/main/ipc/LedgerIpc';
import { registerPricesIpcHandlers } from 'src/main/ipc/PricesIpc';
import { buildAppMenuTemplate, buildDrawnMenuBar, drawsOwnMenuBar } from 'src/main/menu/AppMenu';
import { createYahooPriceProvider } from 'src/main/prices/YahooPriceProvider';
import { createLedgerSession, type LedgerSession } from 'src/main/storage/LedgerSession';
import { isDevelopmentRun, resolveWindowLoadTarget, type WindowLoadTarget } from 'src/main/window/WindowLoadTarget';
import { SPICCIOLI_APP_MENU_IPC_EVENTS } from 'src/types/AppMenuIpcChannels';
import type { SpiccioliMenu } from 'src/types/AppMenuTypes';
import { SPICCIOLI_LEDGER_IPC_EVENTS } from 'src/types/LedgerIpcChannels';
import type { LedgerCloseDoor, LedgerMenuCommand } from 'src/types/LedgerIpcTypes';

let mainWindow: BrowserWindow | undefined;

// Whether the renderer draws the menu bar rather than the operating system. It is decided once at startup, because it is also what
// hides the title bar the drawn one takes the place of, and the window has to know that before it is created.
let drawsMenuBar = false;

// What that drawn bar says, rebuilt with the native menu rather than asked for again: Open Recent changes every time a file is
// opened, and the window is told rather than left to notice
let drawnMenuBar: SpiccioliMenu[] = [];

// Only the first failure opens a dialog. A process that started failing usually keeps failing, and a stack of error boxes would
// bury the window instead of reporting anything the first one did not already say.
let hasReportedFatalError = false;

// Set as soon as the application knows which language to speak, so that a failure after that point can be worded for the user
let fatalErrorTranslator: SpiccioliTranslator | undefined;

// The renderer is the side that has to finish saving before the file can stop being the open one, so a quit asks it to and waits.
// Once it has answered, or the wait has run out, the quit is let through.
let isShuttingDown = false;

// What the wait is made of, kept so that a renderer holding something unwritten can call the whole shutdown off
let shutdownPoll: ReturnType<typeof setInterval> | undefined;

// Set while the renderer is asking the user what to do about changes that never reached the file. The close is still on and the
// poll is still running; what stops is the clock that would otherwise give up on a renderer that is only waiting on a person.
let isShutdownPaused = false;

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

// The only place a version number appears, opened by the About item of whichever menu the platform draws
const showAboutBox = (translator: SpiccioliTranslator): void => {
	void dialog.showMessageBox({
		type: 'info',
		title: translator.t('menu.about', { name: translator.t('app.name') }),
		message: translator.t('app.name'),
		detail: translator.t('menu.aboutVersion', { version: app.getVersion() })
	});
};

// A File action ends the current session, so none of them acts here: it is sent to the renderer, which is the side that has to
// finish saving before the file can stop being the open one
const sendMenuCommandToRenderer = (command: LedgerMenuCommand): void => {
	sendToRenderer(SPICCIOLI_LEDGER_IPC_EVENTS.menuCommand, command);
};

// Rebuilt rather than patched, because Open Recent changes every time a file is opened and Electron has no way to replace one
// submenu. The drawn bar is rebuilt on the same call and for the same reason, and the window is told it changed.
const installApplicationMenu = (translator: SpiccioliTranslator, configStore: SpiccioliConfigStore, isDevelopment: boolean): void => {
	const recentFiles = configStore.readRecentFiles();

	Menu.setApplicationMenu(Menu.buildFromTemplate(buildAppMenuTemplate({
		translator,
		isMac: process.platform === 'darwin',
		recentFiles,
		isDevelopmentRun: isDevelopment,
		onCommand: sendMenuCommandToRenderer,
		onAbout: () => {
			showAboutBox(translator);
		},
		onQuit: () => {
			app.quit();
		}
	})));

	// Nothing at all where the platform keeps its native menu bar, which is what tells the renderer to draw none
	drawnMenuBar = drawsMenuBar ? buildDrawnMenuBar({ translator, recentFiles }) : [];
	sendToRenderer(SPICCIOLI_APP_MENU_IPC_EVENTS.menuBarChanged, drawnMenuBar);
};

const clearShutdownWait = (): void => {
	if(shutdownPoll) {
		clearInterval(shutdownPoll);
		shutdownPoll = undefined;
	}

	isShutdownPaused = false;
};

/**
 * Asks the renderer to finish what it is doing and close the session, then lets the close it was asked for through.
 *
 * **The wait is bounded on being idle rather than on the whole close**, and that distinction is the whole of it. A renderer
 * that cannot answer must not be able to stop the application from exiting; a renderer that is *writing* is answering, and a
 * write has five attempts and a timeout each — far more than the seconds an unresponsive one is given. Cutting that off at the
 * idle bound would throw away the very changes the close exists to finish writing. So the clock runs only while nothing is
 * moving, and a second bound covers the whole thing so that no state can hold the application open forever.
 * @param session The open session, which is what knows when there is nothing left to write.
 * @param door Which of the four doors the session is leaving by.
 * @param finish What the close was: letting the quit through, or letting the window go.
 */
const beginShutdown = (session: LedgerSession, door: LedgerCloseDoor, finish: () => void): void => {
	isShuttingDown = true;
	isShutdownPaused = false;
	sendToRenderer(SPICCIOLI_LEDGER_IPC_EVENTS.prepareForClose, door);

	const startedAt = Date.now();

	// When the close last did something. A write in flight keeps moving it, so the idle bound below is a bound on a renderer
	// that has stopped rather than on one that is still working.
	let progressedAt = startedAt;

	const giveUp = (reason: 'timed-out' | 'took-too-long'): void => {
		appLogger.warn('The renderer did not finish closing in time, closing anyway', {
			type: 'ledger.closed',
			door,
			reason
		});
		clearShutdownWait();
		isShuttingDown = false;
		finish();
	};

	// The renderer answers by closing the session, and the session is what knows when there is nothing left to write
	shutdownPoll = setInterval(() => {
		if(session.getOpenFilePath() === undefined) {
			clearShutdownWait();
			isShuttingDown = false;
			finish();

			return;
		}

		// Waiting on a person is not being idle, and neither is a write that is still going
		if(isShutdownPaused || session.isWriting()) {
			progressedAt = Date.now();

			return;
		}

		if(Date.now() - progressedAt >= SHUTDOWN_CONFIG.idleTimeoutMs) {
			giveUp('timed-out');

			return;
		}

		if(Date.now() - startedAt >= SHUTDOWN_CONFIG.maximumWaitMs) {
			giveUp('took-too-long');
		}
	}, SHUTDOWN_CONFIG.pollIntervalMs);
};

/**
 * Calls a shutdown off, which is the renderer's other answer: something on screen has not been written and the user chose to
 * stay with it rather than lose it. The quit that was asked for is abandoned and asking for one again starts it over.
 */
const cancelShutdown = (): void => {
	clearShutdownWait();
	isShuttingDown = false;
};

/**
 * Holds the wait off while the renderer asks the user what to do about changes that never reached the file.
 * The close is still the one that was asked for and still finishes on its own the moment the session closes — this only stops
 * the application from giving up on a renderer that is doing exactly what it should be doing.
 */
const pauseShutdown = (): void => {
	isShutdownPaused = true;
};

// The window options that put the menu bar inside the page instead of above it. Hiding the operating system's title bar is what
// makes room for it: what stays is the overlay Electron keeps drawing the minimize, maximize and close buttons in, told which two
// colors to draw them in so that they belong to the same window as everything below.
const buildDrawnTitleBarWindowOptions = (): Pick<BrowserWindowConstructorOptions, 'titleBarStyle' | 'titleBarOverlay'> => {
	return {
		titleBarStyle: 'hidden',
		titleBarOverlay: {
			color: TITLE_BAR_CONFIG.backgroundColor,
			symbolColor: TITLE_BAR_CONFIG.symbolColor,
			height: TITLE_BAR_CONFIG.heightPixels
		}
	};
};

// What the window loads, resolved once at startup so that every window of this run loads the same page
const createWindow = (loadTarget: WindowLoadTarget, translator: SpiccioliTranslator, session: LedgerSession): void => {
	const win = new BrowserWindow({
		width: WINDOW_CONFIG.widthPixels,
		height: WINDOW_CONFIG.heightPixels,
		show: false,
		title: translator.t('app.name'),
		...drawsMenuBar ? buildDrawnTitleBarWindowOptions() : {},
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, WINDOW_CONFIG.preloadScriptFileName)
		}
	});

	// The native menu stays installed, because its items are what answer the keyboard shortcuts, but a window that draws the menu
	// itself must not have it above the page as well. Electron draws that bar inside the window once the title bar is hidden, so it
	// is turned off here rather than left to look like a second menu nobody styled.
	if(drawsMenuBar) {
		win.setMenuBarVisibility(false);
	}

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

	// **Closing the window is a close of the session, and the renderer is the side that performs it** — so the window cannot be
	// allowed to go first. A destroyed window takes the renderer with it, and with it the model, the debounced write nobody has
	// asked for yet and the closing copy that is supposed to be taken here. The close is refused once, the renderer is asked to
	// finish, and the window goes when the session has actually closed.
	win.on('close', (event) => {
		if(isShuttingDown || session.getOpenFilePath() === undefined) {
			return;
		}

		event.preventDefault();
		beginShutdown(session, 'window-closed', () => {
			win.destroy();
		});
	});

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

		// Resolved before the window, because every window of this run loads the same page, and because the menu is decided from it
		const loadTarget = resolveWindowLoadTarget({
			appRootDirectory: app.getAppPath(),
			isPackaged: app.isPackaged
		});
		const isDevelopment = isDevelopmentRun(loadTarget);

		// On Windows the native menu is installed but hidden, and the renderer draws one of its own in the colors of the application.
		// The window has to know before it is created, because that is what hides the title bar the drawn one takes the place of.
		drawsMenuBar = drawsOwnMenuBar({ platform: process.platform, isDevelopmentRun: isDevelopment });

		const runtimePaths = resolveSpiccioliRuntimePaths(app);

		// Read before the logger rather than after it, because the level the log opens at is one of the preferences and the very
		// first entry has to be written under it. Reading the configuration file writes nothing, so nothing is lost by having no
		// logger yet: a file that cannot be read comes back as the defaults.
		const configStore = createSpiccioliConfigStore({ configFilePath: runtimePaths.configFilePath });
		const preferences = configStore.readPreferences();

		initializeAppLogger({
			logDirectory: runtimePaths.logDirectory,
			fileName: LOGGING_CONFIG.fileName,
			maximumFileSizeBytes: LOGGING_CONFIG.maximumFileSizeBytes,
			retainedArchiveCount: LOGGING_CONFIG.retainedArchiveCount,
			level: preferences.logLevel
		});

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
			rendererSource: isDevelopment ? 'development-server' : 'build',
			rendererLocation: loadTarget.value,
			drawsMenuBar,
			rootDirectory: runtimePaths.rootDirectory,
			configFilePath: runtimePaths.configFilePath,
			logFilePath: path.join(runtimePaths.logDirectory, LOGGING_CONFIG.fileName),
			autosaveDebounceMs: STORAGE_CONFIG.autosaveDebounceMs,
			maximumWriteAttempts: STORAGE_CONFIG.maximumWriteAttempts,
			writeRetryDelayMs: STORAGE_CONFIG.writeRetryDelayMs,
			writeTimeoutMs: STORAGE_CONFIG.writeTimeoutMs,
			backupCount: preferences.backupCount,
			logMaximumFileSizeBytes: LOGGING_CONFIG.maximumFileSizeBytes,
			logRetainedArchiveCount: LOGGING_CONFIG.retainedArchiveCount,
			logLevel: preferences.logLevel
		});

		const session = createLedgerSession({
			translator,
			readBackupCount: () => {
				return configStore.readPreferences().backupCount;
			},
			rememberRecentFile: (filePath) => {
				configStore.rememberRecentFile(filePath);
				installApplicationMenu(translator, configStore, isDevelopment);
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
			platform: process.platform,
			logDirectory: runtimePaths.logDirectory
		});

		// The renderer is told what to draw, and nothing at all where the platform keeps its native menu bar, so a Spiccioli that has
		// one never draws a second. What comes back is one of a closed set of commands, and the File ones reach the very callbacks the
		// native items click.
		registerAppMenuIpcHandlers({
			ipcMain,
			getMenuBar: () => {
				return drawnMenuBar;
			},
			commandTarget: {
				getWindow: () => {
					return mainWindow;
				},
				onLedgerCommand: sendMenuCommandToRenderer,
				onAbout: () => {
					showAboutBox(translator);
				},
				onQuit: () => {
					app.quit();
				},
				offersRecentFile: (filePath) => {
					return configStore.readRecentFiles().some((recentFile) => {
						return recentFile.filePath === filePath && !recentFile.missing;
					});
				}
			}
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
				installApplicationMenu(translator, configStore, isDevelopment);
			},
			onCloseCancelled: cancelShutdown,
			onClosePaused: pauseShutdown,

			// A preference applies the moment it is changed, and the log level is no exception: the next entry is written under the
			// level that was just chosen rather than under the one this run started at
			onPreferencesChanged: (changed) => {
				appLogger.setLevel(changed.logLevel);
			}
		});

		installApplicationMenu(translator, configStore, isDevelopment);
		createWindow(loadTarget, translator, session);

		// A quit is a close of the session, and the renderer is asked to finish first so that the closing copy is taken with
		// everything already written. Closing the window is the same event by another door and is handled on the window itself,
		// because that one has to be stopped before the renderer is destroyed.
		app.on('before-quit', (event) => {
			if(!isShuttingDown && session.getOpenFilePath() !== undefined) {
				event.preventDefault();
				beginShutdown(session, 'quit', () => {
					app.quit();
				});
			}
		});

		app.on('activate', () => {
			if(BrowserWindow.getAllWindows().length === 0) {
				createWindow(loadTarget, translator, session);
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
