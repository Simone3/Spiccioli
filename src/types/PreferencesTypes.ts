/**
 * The thirteen preferences, and the list of recently opened files.
 *
 * **Neither is in the ledger.** They belong to the installation and live in the platform's own application-data folder, so they
 * survive switching files, apply to every file opened afterwards, and do not travel with a ledger that is copied or sent to
 * somebody else.
 *
 * Every preference is a closed set or a bounded number: there is no free-text setting anywhere, and nothing here can be given a
 * value the application then has to interpret. The two separators are stored as the names of the characters rather than as the
 * characters themselves, so that a space is visible in the file and "none" is a value rather than an empty string.
 */

export const DATE_FORMATS = [ 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD' ] as const;

export type DateFormat = typeof DATE_FORMATS[number];

export const DECIMAL_SEPARATORS = [ 'comma', 'dot' ] as const;

export type DecimalSeparator = typeof DECIMAL_SEPARATORS[number];

export const THOUSANDS_SEPARATORS = [ 'dot', 'comma', 'space', 'none' ] as const;

export type ThousandsSeparator = typeof THOUSANDS_SEPARATORS[number];

// What the operational log is allowed to write, most severe first. A level in force admits itself and everything before it, so
// "info" is info, warn and error. The names are the framework logger's own, and the value goes straight to it.
export const LOG_LEVELS = [ 'error', 'warn', 'info', 'debug' ] as const;

export type LogLevel = typeof LOG_LEVELS[number];

// The lengths a contribution period may have: the divisors of 12, which are the ones that never straddle a year end
export const PENSION_CONTRIBUTION_PERIODS = [ 1, 2, 3, 4, 6, 12 ] as const;

export const SEPARATOR_CHARACTERS: Record<DecimalSeparator | ThousandsSeparator, string> = {
	comma: ',',
	dot: '.',
	space: ' ',
	none: ''
};

export interface Preferences {
	dateFormat: DateFormat;
	decimalSeparator: DecimalSeparator;
	thousandsSeparator: ThousandsSeparator;

	// A percentage stored as the fraction it names, in ten-thousandths: 26% is 2600
	defaultTaxRate: number;
	priceStalenessDays: number;
	pensionRevaluationMonths: number;
	receiptPendingMonths: number;
	transferMatchWindowDays: number;

	// How many days before the sending leg the receiving one may be dated. Zero is the forward-only rule of [§11.6].
	transferMatchBackwardDays: number;
	tradeMatchWindowDays: number;

	// How many months of payslips one credit into the pension fund covers. One of PENSION_CONTRIBUTION_PERIODS, and 1 is a fund crediting every month.
	pensionContributionMonths: number;
	backupCount: number;

	// How much the operational log is allowed to say. It reaches the main process's logger, and nothing below it is written at all.
	logLevel: LogLevel;
}

export interface RecentLedgerFile {
	filePath: string;

	// Local time, as an ISO instant. Shown on the launch screen and used for nothing else.
	lastOpenedAt: string;

	// Whether the file is still where it was. A recent entry whose file moved is struck through and stays in the list until it is dismissed.
	missing: boolean;
}

// What the application-data file holds. The recent list is stored without the "missing" flag, which is a fact about right now.
export interface SpiccioliConfig {
	preferences: Preferences;
	recentFiles: Omit<RecentLedgerFile, 'missing'>[];
}
