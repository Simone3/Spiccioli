import { DEFAULT_PREFERENCES, parsePreferences } from 'src/logic/preferences/Preferences';
import { formatDate, formatDateAndTime } from 'src/logic/format/DateFormat';
import { getDirectory, getFileName, getFileNameWithoutExtension } from 'src/logic/format/FilePathDisplay';

describe('parsePreferences', () => {
	test('reads a first startup as every default', () => {
		expect(parsePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
		expect(parsePreferences('not an object')).toEqual(DEFAULT_PREFERENCES);
	});

	test('keeps a value that is one of the closed set', () => {
		expect(parsePreferences({ dateFormat: 'YYYY-MM-DD' }).dateFormat).toBe('YYYY-MM-DD');
	});

	test('falls back to the default for a value outside its closed set', () => {
		expect(parsePreferences({ dateFormat: 'DD.MM.YY' }).dateFormat).toBe(DEFAULT_PREFERENCES.dateFormat);
	});

	test('falls back for a number outside its bounds rather than clamping it', () => {
		expect(parsePreferences({ backupCount: 0 }).backupCount).toBe(DEFAULT_PREFERENCES.backupCount);
		expect(parsePreferences({ backupCount: 101 }).backupCount).toBe(DEFAULT_PREFERENCES.backupCount);
		expect(parsePreferences({ backupCount: 3 }).backupCount).toBe(3);
		expect(parsePreferences({ transferMatchWindowDays: 0 }).transferMatchWindowDays).toBe(0);
		expect(parsePreferences({ transferMatchWindowDays: 32 }).transferMatchWindowDays).toBe(DEFAULT_PREFERENCES.transferMatchWindowDays);
	});

	test('refuses a separator pair that collides', () => {
		expect(parsePreferences({ decimalSeparator: 'dot', thousandsSeparator: 'dot' }).thousandsSeparator).toBe(DEFAULT_PREFERENCES.thousandsSeparator);
		expect(parsePreferences({ decimalSeparator: 'dot', thousandsSeparator: 'comma' }).thousandsSeparator).toBe('comma');
	});

	test('lets none be the thousands separator, which never collides', () => {
		expect(parsePreferences({ decimalSeparator: 'comma', thousandsSeparator: 'none' }).thousandsSeparator).toBe('none');
	});

	test('reads the default tax rate as the fraction it names', () => {
		expect(DEFAULT_PREFERENCES.defaultTaxRate).toBe(2600);
		expect(parsePreferences({ defaultTaxRate: 1250 }).defaultTaxRate).toBe(1250);
	});
});

describe('formatDate', () => {
	const day = new Date(2026, 7, 8, 14, 32);

	test('follows the preference and never a system locale', () => {
		expect(formatDate(day, 'DD/MM/YYYY')).toBe('08/08/2026');
		expect(formatDate(day, 'MM/DD/YYYY')).toBe('08/08/2026');
		expect(formatDate(day, 'YYYY-MM-DD')).toBe('2026-08-08');
		expect(formatDate(new Date(2026, 10, 3), 'DD/MM/YYYY')).toBe('03/11/2026');
		expect(formatDate(new Date(2026, 10, 3), 'MM/DD/YYYY')).toBe('11/03/2026');
	});

	test('prints the clock in 24 hours', () => {
		expect(formatDateAndTime(day, 'YYYY-MM-DD')).toBe('2026-08-08 14:32');
	});
});

describe('reading a path apart', () => {
	test('splits a path on either platform', () => {
		expect(getFileName('/Users/x/Documents/finances.spiccioli')).toBe('finances.spiccioli');
		expect(getFileName('C:\\Users\\x\\finances.spiccioli')).toBe('finances.spiccioli');
		expect(getDirectory('/Users/x/Documents/finances.spiccioli')).toBe('/Users/x/Documents');
		expect(getDirectory('C:\\Users\\x\\finances.spiccioli')).toBe('C:\\Users\\x');
	});

	test('takes the extension off the name, which is what the window title carries', () => {
		expect(getFileNameWithoutExtension('/Users/x/finances.spiccioli')).toBe('finances');
		expect(getFileNameWithoutExtension('/Users/x/finances-2016.spiccioli')).toBe('finances-2016');
		expect(getFileNameWithoutExtension('/Users/x/.hidden')).toBe('.hidden');
	});
});
