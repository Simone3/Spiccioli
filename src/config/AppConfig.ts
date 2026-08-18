/**
 * App-wide configuration values.
 * Centralizes tunable constants (sizes, delays, retry policies, file and directory names) instead of spreading them as magic numbers across modules.
 * This file is shared by the Electron main process and the React renderer, so it must stay free of Node and Electron imports.
 */

export const WINDOW_CONFIG = {
	widthPixels: 1200,
	heightPixels: 800,
	preloadScriptFileName: 'preload.js',
	reactBuildIndexPathSegments: [ 'build', 'index.html' ],

	// "npm start" sets this to the Vite development server it started, and the main process loads the renderer from there instead of
	// from disk. Every other run leaves it unset and loads the built "build/index.html".
	developmentServerUrlVariable: 'SPICCIOLI_DEVELOPMENT_SERVER_URL'
} as const;

export const I18N_CONFIG = {
	// Used when the runtime asks for a language Spiccioli does not ship a bundle for. It must be one of the languages in "src/i18n/Translations.ts".
	defaultLanguage: 'en'
} as const;

// The preferences and the list of recently opened ledgers, which belong to the installation rather than to any one ledger file
export const APP_CONFIG_FILE = {
	developmentDirectoryName: 'dev',
	fileName: 'spiccioli-config.json'
} as const;

export const LOGGING_CONFIG = {
	directoryName: 'logs',
	fileName: 'spiccioli-logs.ndjson',
	maximumFileSizeBytes: 100 * 1024 * 1024,
	retainedArchiveCount: 5
} as const;

// The list the launch screen and File › Open Recent both show. It is bounded so that the configuration file cannot grow without
// limit; nothing in the functional analysis fixes the number.
export const RECENT_FILES_CONFIG = {
	maximumEntries: 10
} as const;

// The ledger file itself: one JSON document, read whole and written whole, with its backups in a folder beside it named after it
export const LEDGER_FILE_CONFIG = {
	extension: '.spiccioli',

	// A ledger at ".../finances.spiccioli" keeps its copies in ".../finances-backups/"
	backupDirectorySuffix: '-backups',

	// The temporary file an atomic write renames over the ledger. It is written in the ledger's own directory, so that the rename
	// stays inside one filesystem and is therefore atomic.
	temporaryFileSuffix: '.saving',

	// What a copy's name says about which of the three moments produced it. A closing copy carries no suffix at all.
	closeBackupSuffix: '',
	externalBackupSuffix: '-external',
	preUpgradeBackupSuffix: '-pre-upgrade'
} as const;

// The three figures autosave runs on, and the timeout a single write is given
export const STORAGE_CONFIG = {
	autosaveDebounceMs: 2000,
	maximumWriteAttempts: 5,
	writeRetryDelayMs: 3000,
	writeTimeoutMs: 10000
} as const;

// A quit asks the renderer to finish saving and close the session first. The wait is bounded, because a renderer that cannot
// answer must not be able to stop the application from exiting.
export const SHUTDOWN_CONFIG = {
	prepareForCloseTimeoutMs: 8000,
	pollIntervalMs: 50
} as const;

// The one paginated table in the application. Every other table is shown in full, so this is the only page size there is.
export const TRANSACTIONS_CONFIG = {
	rowsPerPage: 50
} as const;

// The fourteen checks: how often a change is allowed to start a run, and how many records one failing check names before it
// states the whole count instead. Neither figure is fixed by the functional analysis; the five is what its examples show.
export const CHECKS_CONFIG = {
	debounceMs: 400,
	maximumEntriesPerSide: 5
} as const;

// A render error is worded by the renderer, so the lengths the main process will write are fixed here rather than there: nothing the
// renderer sends can grow a log line without limit
export const DIAGNOSTICS_CONFIG = {
	maximumRenderErrorMessageLength: 500,
	maximumRenderErrorStackLength: 4000,
	maximumRenderErrorComponentStackLength: 4000
} as const;

// The one thing in the application that touches the network: one request per security, spaced rather than fired at once, and
// nothing the provider answers with allowed to grow a panel row or a log line without limit
export const PRICES_CONFIG = {
	requestSpacingMs: 400,
	requestTimeoutMs: 10000,
	maximumFailureMessageLength: 200,
	maximumCurrencyCodeLength: 12
} as const;
