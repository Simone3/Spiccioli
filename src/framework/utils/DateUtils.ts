/**
 * Names for the days closest to today, so that the application owns the wording and the framework only decides which one applies.
 * A label that is not given falls through to the next rule, which lets an application label only the days it cares about.
 */
export interface SmartDateLabels {
	today?: string;
	yesterday?: string;
	tomorrow?: string;
}

export interface SmartDateOptions {
	labels: SmartDateLabels;

	// How many days after tomorrow are shown as a weekday name instead of a full date
	weekdayHorizonDays?: number;

	// Left undefined to format in the runtime locale
	locale?: string;
	absoluteDateFormat?: Intl.DateTimeFormatOptions;
}

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

const DEFAULT_ABSOLUTE_DATE_FORMAT: Intl.DateTimeFormatOptions = {
	day: 'numeric',
	month: 'long',
	year: 'numeric'
};

const WEEKDAY_FORMAT: Intl.DateTimeFormatOptions = {
	weekday: 'long'
};

// Building an Intl formatter costs far more than using one, and these format once per rendered row, so they are memoized by locale and format
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

const getDateFormatter = (locale: string | undefined, format: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
	const cacheKey = `${locale ?? ''}|${JSON.stringify(format)}`;
	const cachedFormatter = dateFormatters.get(cacheKey);

	if(cachedFormatter) {
		return cachedFormatter;
	}

	const formatter = new Intl.DateTimeFormat(locale, format);
	dateFormatters.set(cacheKey, formatter);

	return formatter;
};

// The start of today only changes at midnight, so it is computed once per day instead of once per call. Recomputing it when the day
// changes is also what keeps relative labels honest in an application left open across midnight: the next render is correct again,
// without anything having to hold the current day as state and refresh it on a timer.
let cachedStartOfToday: Date | undefined;

export class DateUtils {
	static isSameDay(date1: Date, date2: Date): boolean {
		return this.compareDay(date1, date2) === 0;
	}

	static compareDay(date1: Date, date2: Date): number {
		if(!date1 || !date2) {
			throw Error('Invalid empty date(s)');
		}

		if(date1.getFullYear() < date2.getFullYear()) {
			return -1;
		}
		else if(date1.getFullYear() > date2.getFullYear()) {
			return 1;
		}

		if(date1.getMonth() < date2.getMonth()) {
			return -1;
		}
		else if(date1.getMonth() > date2.getMonth()) {
			return 1;
		}

		if(date1.getDate() < date2.getDate()) {
			return -1;
		}
		else if(date1.getDate() > date2.getDate()) {
			return 1;
		}

		return 0;
	}

	/**
	 * Returns local midnight of the given date.
	 * @param date Date to truncate.
	 * @returns A new date at the start of that day.
	 */
	static startOfDay(date: Date): Date {
		const startOfDay = new Date(date);
		startOfDay.setHours(0, 0, 0, 0);

		return startOfDay;
	}

	/**
	 * Returns local midnight of the current day, recomputed only when the day changes.
	 * @returns The start of today. The returned date is a copy, so callers cannot corrupt the cached value.
	 */
	static startOfToday(): Date {
		const now = new Date();

		if(!cachedStartOfToday || !this.isSameDay(cachedStartOfToday, now)) {
			cachedStartOfToday = this.startOfDay(now);
		}

		return new Date(cachedStartOfToday);
	}

	/**
	 * Counts whole days between today and the given date.
	 * The two days are compared as UTC day numbers, so a daylight saving change cannot make a day count as 0 or 2.
	 * @param date Date to measure.
	 * @returns 0 for today, negative for the past, positive for the future.
	 */
	static dayOffsetFromToday(date: Date): number {
		const toUtcDayNumber = (value: Date): number => {
			return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / MILLIS_PER_DAY;
		};

		return toUtcDayNumber(date) - toUtcDayNumber(this.startOfToday());
	}

	/**
	 * Formats a date as the nearest thing the reader recognizes: a name for the days around today, a weekday name for the days
	 * shortly after, and a full date for everything else.
	 * @param date Date to format.
	 * @param options Labels for the days around today, and how the rest is formatted.
	 * @returns The formatted date, or an empty string when there is no date.
	 */
	static toSmartString(date: Date | null | undefined, options: SmartDateOptions): string {
		if(!date) {
			return '';
		}

		const { labels, weekdayHorizonDays = 0, locale, absoluteDateFormat = DEFAULT_ABSOLUTE_DATE_FORMAT } = options;
		const dayOffset = this.dayOffsetFromToday(date);

		if(dayOffset === 0 && labels.today) {
			return labels.today;
		}

		if(dayOffset === -1 && labels.yesterday) {
			return labels.yesterday;
		}

		if(dayOffset === 1 && labels.tomorrow) {
			return labels.tomorrow;
		}

		// Tomorrow already has a name of its own, so the weekday names start the day after it
		if(dayOffset >= 2 && dayOffset <= weekdayHorizonDays + 1) {
			return getDateFormatter(locale, WEEKDAY_FORMAT).format(date);
		}

		return getDateFormatter(locale, absoluteDateFormat).format(date);
	}

	static toStandardYearMonthDay(date: Date | null | undefined): string {
		return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
	}

	/**
	 * Parses a stored YYYY-MM-DD string as a local date.
	 * The native Date constructor reads that format as UTC midnight, which shifts the day backwards in negative UTC offsets, so it cannot be used here.
	 * @param value Stored YYYY-MM-DD date string.
	 * @returns The local date, or undefined if the string is empty or malformed.
	 */
	static fromStandardYearMonthDay(value: string | null | undefined): Date | undefined {
		if(!value) {
			return undefined;
		}

		const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
		if(!match) {
			return undefined;
		}

		const [ , year, month, day ] = match;
		const date = new Date(Number(year), Number(month) - 1, Number(day));

		return Number.isNaN(date.getTime()) ? undefined : date;
	}

	/**
	 * Returns the first working day strictly after the given day, skipping Saturday and Sunday.
	 * @param from Day to start from, today by default.
	 * @returns The next working day, at local midnight.
	 */
	static nextWorkingDay(from: Date = new Date()): Date {
		const workingDay = this.startOfDay(from);

		do {
			workingDay.setDate(workingDay.getDate() + 1);
		}
		while(workingDay.getDay() === 0 || workingDay.getDay() === 6);

		return workingDay;
	}
}
