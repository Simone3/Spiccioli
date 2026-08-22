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

// The row Spiccioli draws in place of the title bar the operating system would, on the platform where the native menu bar cannot
// be made to look like the rest of the application
export const TITLE_BAR_CONFIG = {

	// How tall the drawn title bar is, and therefore how tall the native window buttons Electron overlays on it are. The renderer
	// reads the height back from the overlay instead of repeating this number, so this is the only place it is decided.
	heightPixels: 32,

	// The window buttons are drawn by the operating system, so their two colors are given to Electron rather than to CSS. They mirror
	// "--colors-background-primary" and "--colors-text-primary" in "src/index.css" and have to be changed with them.
	backgroundColor: '#15140F',
	symbolColor: '#E8E4D8'
} as const;

// What the View menu's zoom entries do. Chromium clamps zoom itself, but only far past the point where a table of figures is unusable.
export const ZOOM_CONFIG = {

	// One step of the zoom entries, in Chromium zoom levels: every level is 1.2 times the previous one
	stepLevel: 0.5,

	// How far the entries go, which is roughly a third of the normal size and a little over twice it
	minimumLevel: -5,
	maximumLevel: 5
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
	preUpgradeBackupSuffix: '-pre-upgrade',

	// How much of a value a refusal quotes back on screen. Long enough to recognise what is in the file, short enough that a
	// whole record pasted into one field cannot push the rest of the sentence off the panel.
	refusedValueLengthLimit: 60
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

// The transactions list, one of the two paginated tables in the application. Every other table is shown in full.
export const TRANSACTIONS_CONFIG = {
	rowsPerPage: 50
} as const;

// A security's price history, the other paginated table. It pages shorter than the transactions list because it sits in a panel
// beside the securities rather than across a screen of its own.
export const PRICE_HISTORY_CONFIG = {
	rowsPerPage: 20
} as const;

// The list of types beside the pie on Portfolio, which runs in columns read downwards. Neither figure is fixed by the
// functional analysis: the two is what the mockup draws, and the three is what keeps a portfolio of few types from being split
// into a column of two and a column of one.
export const PORTFOLIO_CONFIG = {
	typeListColumns: 2,
	minimumRowsPerTypeListColumn: 3
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

	// A span of years comes back as one response of several thousand days, so it is given longer than a single quote is
	historyRequestTimeoutMs: 30000,
	maximumFailureMessageLength: 200,
	maximumCurrencyCodeLength: 12,

	// How much of one response body the log is allowed to carry. A span of years comes back as several thousand days, and a pass
	// over a file of forty securities would otherwise put a good part of the log's whole size limit down in one press of a button.
	maximumLoggedBodyLength: 20000
} as const;
