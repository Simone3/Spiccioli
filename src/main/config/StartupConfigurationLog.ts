import { appLogger } from 'src/framework/main/logging/AppLogger';
import type { LogLevel } from 'src/types/PreferencesTypes';

/**
 * The one entry that describes the run the rest of the log file belongs to.
 *
 * It is written the moment the logger comes up, before anything else can fail, because it is what makes every later line
 * legible to whoever collects the file after something went wrong: which build this was, on what, where the renderer came from,
 * where the installation keeps its own files, and the settings that decide how a run behaves.
 *
 * **No ledger is named**, because none is open yet. Paths are not redacted: the ledger's own path is already in the recent-file
 * list in plain text, and no storage failure can be diagnosed without knowing which file it was about.
 */

export interface StartupConfigurationLogOptions {
	version: string;
	isDevelopment: boolean;
	platform: string;
	architecture: string;
	electronVersion: string;
	chromeVersion: string;
	nodeVersion: string;

	// What the operating system asked for, and which of the bundles Spiccioli ships that resolved to
	requestedLocale: string;
	resolvedLanguage: string;

	rendererSource: 'development-server' | 'build';
	rendererLocation: string;

	// Whether the window hides its native menu bar and the renderer draws one, which is what a report of a menu that is not there
	// has to be read against
	drawsMenuBar: boolean;

	rootDirectory: string;
	configFilePath: string;
	logFilePath: string;

	autosaveDebounceMs: number;
	maximumWriteAttempts: number;
	writeRetryDelayMs: number;
	writeTimeoutMs: number;
	backupCount: number;
	logMaximumFileSizeBytes: number;
	logRetainedArchiveCount: number;

	// The level this entry itself was written under. It is the preference in force at startup, and it is what a reader has to know
	// before concluding that an entry is missing because nothing happened rather than because nothing was allowed to say so.
	logLevel: LogLevel;
}

/**
 * Writes the entry that opens a run's log.
 * @param options Everything about the run that a later line might be read against.
 */
export const logStartupConfiguration = (options: StartupConfigurationLogOptions): void => {
	appLogger.info('Spiccioli started', {
		type: 'config.startup',
		...options
	});
};
