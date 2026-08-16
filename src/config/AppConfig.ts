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
