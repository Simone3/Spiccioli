import {
	DATE_FORMATS,
	DECIMAL_SEPARATORS,
	LOG_LEVELS,
	PENSION_CONTRIBUTION_PERIODS,
	SEPARATOR_CHARACTERS,
	THOUSANDS_SEPARATORS,
	type DecimalSeparator,
	type Preferences,
	type ThousandsSeparator
} from 'src/types/PreferencesTypes';

/**
 * The defaults every preference falls back to, and the reading of whatever the configuration file happens to hold.
 *
 * **Nothing here refuses a file.** A preference is not ledger data: it belongs to the installation, and a value that is missing,
 * out of range or a shape nobody wrote reads as that preference's default rather than as a reason to stop. That is the opposite
 * of how the ledger reader treats an unrecognised value, and deliberately so — one is the user's data and the other is a setting
 * that has a sensible value to fall back to.
 */

export const DEFAULT_PREFERENCES: Preferences = {
	dateFormat: 'DD/MM/YYYY',
	decimalSeparator: 'comma',
	thousandsSeparator: 'dot',

	// 26%, as the fraction it names, in ten-thousandths
	defaultTaxRate: 2600,
	priceStalenessDays: 30,
	pensionRevaluationMonths: 3,
	receiptPendingMonths: 3,
	transferMatchWindowDays: 5,

	// A weekend and a day, which is what two banks dating one movement differently comes to
	transferMatchBackwardDays: 3,
	tradeMatchWindowDays: 5,

	// One credit per month, which is the fund crediting as often as a payslip is written
	pensionContributionMonths: 1,
	backupCount: 10,

	// Info and above, which is every entry that describes what the application did and none of the ones that describe how
	logLevel: 'info'
};

/**
 * Says whether the two separators would be the same character, which is the one thing neither Settings nor an import will take.
 * **None never collides**: it is the absence of a separator rather than a character.
 * @param first One of the two separators.
 * @param second The other one.
 * @returns Whether a figure written with both would carry the same character in two meanings.
 */
export const separatorsCollide = (first: DecimalSeparator | ThousandsSeparator, second: DecimalSeparator | ThousandsSeparator): boolean => {
	return SEPARATOR_CHARACTERS[first] !== '' && SEPARATOR_CHARACTERS[first] === SEPARATOR_CHARACTERS[second];
};

const readChoice = <TValue extends string>(value: unknown, allowedValues: readonly TValue[], fallback: TValue): TValue => {
	return typeof value === 'string' && allowedValues.includes(value as TValue) ? value as TValue : fallback;
};

const readNumericChoice = (value: unknown, allowedValues: readonly number[], fallback: number): number => {
	return typeof value === 'number' && allowedValues.includes(value) ? value : fallback;
};

const readBoundedInteger = (value: unknown, minimum: number, maximum: number, fallback: number): number => {
	if(typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
		return fallback;
	}

	return value;
};

/**
 * Reads the preferences out of whatever was parsed from the configuration file.
 * @param value The raw value the file held, or undefined when there was no readable file at all.
 * @returns Every preference, each either the value the file held or its default.
 */
export const parsePreferences = (value: unknown): Preferences => {
	const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
	const decimalSeparator = readChoice(record.decimalSeparator, DECIMAL_SEPARATORS, DEFAULT_PREFERENCES.decimalSeparator);
	const thousandsSeparator = readChoice(record.thousandsSeparator, THOUSANDS_SEPARATORS, DEFAULT_PREFERENCES.thousandsSeparator);

	return {
		dateFormat: readChoice(record.dateFormat, DATE_FORMATS, DEFAULT_PREFERENCES.dateFormat),
		decimalSeparator,

		// The two separators must differ, and a file holding a pair that collides falls back to the default thousands separator
		thousandsSeparator: separatorsCollide(thousandsSeparator, decimalSeparator) ? DEFAULT_PREFERENCES.thousandsSeparator : thousandsSeparator,
		defaultTaxRate: readBoundedInteger(record.defaultTaxRate, 0, 10000, DEFAULT_PREFERENCES.defaultTaxRate),
		priceStalenessDays: readBoundedInteger(record.priceStalenessDays, 1, Number.MAX_SAFE_INTEGER, DEFAULT_PREFERENCES.priceStalenessDays),
		pensionRevaluationMonths: readBoundedInteger(record.pensionRevaluationMonths, 1, Number.MAX_SAFE_INTEGER, DEFAULT_PREFERENCES.pensionRevaluationMonths),
		receiptPendingMonths: readBoundedInteger(record.receiptPendingMonths, 1, Number.MAX_SAFE_INTEGER, DEFAULT_PREFERENCES.receiptPendingMonths),
		transferMatchWindowDays: readBoundedInteger(record.transferMatchWindowDays, 0, 31, DEFAULT_PREFERENCES.transferMatchWindowDays),
		transferMatchBackwardDays: readBoundedInteger(record.transferMatchBackwardDays, 0, 31, DEFAULT_PREFERENCES.transferMatchBackwardDays),
		tradeMatchWindowDays: readBoundedInteger(record.tradeMatchWindowDays, 0, 31, DEFAULT_PREFERENCES.tradeMatchWindowDays),
		pensionContributionMonths: readNumericChoice(record.pensionContributionMonths, PENSION_CONTRIBUTION_PERIODS, DEFAULT_PREFERENCES.pensionContributionMonths),
		backupCount: readBoundedInteger(record.backupCount, 1, 100, DEFAULT_PREFERENCES.backupCount),
		logLevel: readChoice(record.logLevel, LOG_LEVELS, DEFAULT_PREFERENCES.logLevel)
	};
};
