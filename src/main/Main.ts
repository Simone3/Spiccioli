import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { LOGGING_CONFIG, WINDOW_CONFIG } from 'src/config/AppConfig';
import { appLogger, initializeAppLogger } from 'src/framework/main/logging/AppLogger';
import { installProcessCrashHandlers } from 'src/framework/main/logging/ProcessCrashHandlers';
import { installWindowNavigationGuard } from 'src/framework/main/window/WindowNavigationGuard';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';
import { createSpiccioliTranslator, resolveSpiccioliLanguage, type SpiccioliTranslator } from 'src/i18n/Translations';
import { resolveSpiccioliRuntimePaths } from 'src/main/config/SpiccioliRuntimePaths';
import { registerAppInfoIpcHandlers } from 'src/main/ipc/AppInfoIpc';
import { resolveWindowLoadTarget, type WindowLoadTarget } from 'src/main/window/WindowLoadTarget';

let mainWindow: BrowserWindow | undefined;

// Only the first failure opens a dialog. A process that started failing usually keeps failing, and a stack of error boxes would
// bury the window instead of reporting anything the first one did not already say.
let hasReportedFatalError = false;

// Set as soon as the application knows which language to speak, so that a failure after that point can be worded for the user
let fatalErrorTranslator: SpiccioliTranslator | undefined;

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

// What the window loads, resolved once at startup so that every window of this run loads the same page
const createWindow = (loadTarget: WindowLoadTarget): void => {
	const win = new BrowserWindow({
		width: WINDOW_CONFIG.widthPixels,
		height: WINDOW_CONFIG.heightPixels,
		show: false,
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
		const translator = createSpiccioliTranslator(resolveSpiccioliLanguage([ app.getLocale() ]));
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

		registerAppInfoIpcHandlers({
			ipcMain,
			app,
			platform: process.platform
		});

		createWindow(loadTarget);

		app.on('activate', () => {
			if(BrowserWindow.getAllWindows().length === 0) {
				createWindow(loadTarget);
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
