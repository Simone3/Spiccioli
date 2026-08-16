import { DateUtils, type SmartDateOptions } from 'src/framework/utils/DateUtils';

// A Sunday, so the working day case has a weekend to skip
const TODAY = new Date('2026-05-10T09:30:00');

const LABEL_OPTIONS: SmartDateOptions = {
	labels: {
		today: 'Today',
		yesterday: 'Yesterday',
		tomorrow: 'Tomorrow'
	},
	weekdayHorizonDays: 5,
	locale: 'en-US'
};

describe('DateUtils', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(TODAY);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('compares dates at day granularity', () => {
		expect(DateUtils.compareDay(new Date('2026-05-10T23:59:59'), new Date('2026-05-10T00:00:00'))).toBe(0);
		expect(DateUtils.compareDay(new Date('2026-05-09T23:59:59'), new Date('2026-05-10T00:00:00'))).toBe(-1);
		expect(DateUtils.compareDay(new Date('2026-05-11T00:00:00'), new Date('2026-05-10T23:59:59'))).toBe(1);
	});

	test('counts whole days from today', () => {
		expect(DateUtils.dayOffsetFromToday(new Date('2026-05-10T23:59:59'))).toBe(0);
		expect(DateUtils.dayOffsetFromToday(new Date('2026-05-09T00:00:00'))).toBe(-1);
		expect(DateUtils.dayOffsetFromToday(new Date('2026-05-16T12:00:00'))).toBe(6);
	});

	test('formats smart relative labels before falling back to a full date', () => {
		expect(DateUtils.toSmartString(new Date('2026-05-10T12:00:00'), LABEL_OPTIONS)).toBe('Today');
		expect(DateUtils.toSmartString(new Date('2026-05-09T12:00:00'), LABEL_OPTIONS)).toBe('Yesterday');
		expect(DateUtils.toSmartString(new Date('2026-05-11T12:00:00'), LABEL_OPTIONS)).toBe('Tomorrow');
		expect(DateUtils.toSmartString(new Date('2026-05-12T12:00:00'), LABEL_OPTIONS)).toBe('Tuesday');
		expect(DateUtils.toSmartString(new Date('2026-06-01T12:00:00'), LABEL_OPTIONS)).toBe('June 1, 2026');
		expect(DateUtils.toSmartString(undefined, LABEL_OPTIONS)).toBe('');
	});

	// The weekday names stop where the application says they stop, and tomorrow is not one of them because it has its own label
	test('shows weekday names only up to the requested horizon', () => {
		const twoDayHorizon: SmartDateOptions = {
			...LABEL_OPTIONS,
			weekdayHorizonDays: 2
		};

		expect(DateUtils.toSmartString(new Date('2026-05-12T12:00:00'), twoDayHorizon)).toBe('Tuesday');
		expect(DateUtils.toSmartString(new Date('2026-05-13T12:00:00'), twoDayHorizon)).toBe('Wednesday');
		expect(DateUtils.toSmartString(new Date('2026-05-14T12:00:00'), twoDayHorizon)).toBe('May 14, 2026');
	});

	// An application that does not want a relative name for a day gets the ordinary formatting for it instead
	test('falls through to the date when a label is not given', () => {
		const todayOnly: SmartDateOptions = {
			labels: {
				today: 'Today'
			},
			locale: 'en-US'
		};

		expect(DateUtils.toSmartString(new Date('2026-05-10T12:00:00'), todayOnly)).toBe('Today');
		expect(DateUtils.toSmartString(new Date('2026-05-11T12:00:00'), todayOnly)).toBe('May 11, 2026');
	});

	// An application left open across midnight must not keep calling yesterday "today"
	test('follows the clock into the next day', () => {
		expect(DateUtils.toSmartString(new Date('2026-05-10T12:00:00'), LABEL_OPTIONS)).toBe('Today');

		vi.setSystemTime(new Date('2026-05-11T00:30:00'));

		expect(DateUtils.toSmartString(new Date('2026-05-10T12:00:00'), LABEL_OPTIONS)).toBe('Yesterday');
		expect(DateUtils.toSmartString(new Date('2026-05-11T12:00:00'), LABEL_OPTIONS)).toBe('Today');
	});

	test('returns the start of the current day', () => {
		expect(DateUtils.startOfToday()).toEqual(new Date('2026-05-10T00:00:00'));
	});

	// The value kept for the rest of the day must not be reachable through what callers are handed
	test('hands out a start of day callers cannot corrupt', () => {
		const startOfToday = DateUtils.startOfToday();
		startOfToday.setFullYear(1999);

		expect(DateUtils.startOfToday()).toEqual(new Date('2026-05-10T00:00:00'));
	});

	test('skips the weekend when looking for the next working day', () => {
		expect(DateUtils.nextWorkingDay(new Date('2026-05-08T12:00:00'))).toEqual(new Date('2026-05-11T00:00:00'));
		expect(DateUtils.nextWorkingDay(new Date('2026-05-11T12:00:00'))).toEqual(new Date('2026-05-12T00:00:00'));
		expect(DateUtils.nextWorkingDay()).toEqual(new Date('2026-05-11T00:00:00'));
	});

	test('formats stored dates as YYYY-MM-DD strings', () => {
		expect(DateUtils.toStandardYearMonthDay(new Date('2026-05-09T23:59:59'))).toBe('2026-05-09');
		expect(DateUtils.toStandardYearMonthDay(undefined)).toBe('');
		expect(DateUtils.toStandardYearMonthDay(null)).toBe('');
	});

	// Stored due dates must be parsed at local midnight: the native Date constructor reads YYYY-MM-DD as UTC midnight, which shows the previous day in negative UTC offsets
	test('parses stored YYYY-MM-DD strings as local dates', () => {
		expect(DateUtils.fromStandardYearMonthDay('2026-08-03')!.getTime()).toBe(new Date(2026, 7, 3).getTime());
		expect(DateUtils.toStandardYearMonthDay(DateUtils.fromStandardYearMonthDay('2026-08-03'))).toBe('2026-08-03');
		expect(DateUtils.fromStandardYearMonthDay('')).toBeUndefined();
		expect(DateUtils.fromStandardYearMonthDay(undefined)).toBeUndefined();
		expect(DateUtils.fromStandardYearMonthDay(null)).toBeUndefined();
		expect(DateUtils.fromStandardYearMonthDay('not a date')).toBeUndefined();
	});
});
