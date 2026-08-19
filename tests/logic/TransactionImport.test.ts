import { makeRule, makeTransaction } from '../testUtils';
import { DateUtils } from 'src/framework/utils/DateUtils';
import {
	buildImportedTransactions,
	defaultImportSelection,
	findImportDuplicates,
	importedPeriod,
	parseImportRows,
	type ImportFormat,
	type ImportRow
} from 'src/logic/transactions/TransactionImport';

/**
 * The parser is the only text the application reads, and every one of these cases is a row it either takes or marks.
 * Nothing here is inferred: the format is what the three controls say, and a row that does not fit them cannot be read.
 */

const ITALIAN: ImportFormat = { dateFormat: 'DD/MM/YYYY', decimalSeparator: 'comma', thousandsSeparator: 'dot' };

const AMERICAN: ImportFormat = { dateFormat: 'MM/DD/YYYY', decimalSeparator: 'dot', thousandsSeparator: 'comma' };

const row = (date: string, description: string, amount: string): string => {
	return [ date, description, amount ].join('\t');
};

const parseOne = (text: string, format: ImportFormat = ITALIAN): ImportRow => {
	const rows = parseImportRows(text, format);

	expect(rows).toHaveLength(1);

	return rows[0];
};

// A day that is a real one in the past under every one of the three orders, so that only the amount can refuse the row
const ANY_ORDER_DATE = '01/02/2020';

const readAmountOf = (text: string, format: ImportFormat = ITALIAN): number | undefined => {
	const parsed = parseOne(row(ANY_ORDER_DATE, 'PAGAMENTO POS COOP', text), format);

	return parsed.outcome === 'read' ? parsed.values.amount : undefined;
};

const refusalOf = (text: string, format: ImportFormat = ITALIAN): string | undefined => {
	const parsed = parseOne(text, format);

	return parsed.outcome === 'unreadable' ? parsed.refusal.reason : undefined;
};

const tomorrow = (): string => {
	const day = new Date();
	day.setDate(day.getDate() + 1);

	return DateUtils.toStandardYearMonthDay(day).split('-').reverse().join('/');
};

describe('reading a pasted row', () => {
	test('takes the three columns in their fixed order and ignores whatever follows them', () => {
		const parsed = parseOne('11/07/2026\t PAGAMENTO POS COOP 2213 \t-54,80\tsaldo 1.234,00\tcausale');

		expect(parsed.outcome).toBe('read');
		expect(parsed).toMatchObject({ values: { date: '2026-07-11', description: 'PAGAMENTO POS COOP 2213', amount: -5480 } });
	});

	test('skips a line that is empty or all whitespace without reporting it', () => {
		const rows = parseImportRows(`\n${row('11/07/2026', 'UNO', '-1,00')}\n   \n\n${row('12/07/2026', 'DUE', '2,00')}\n`, ITALIAN);

		expect(rows).toHaveLength(2);
		expect(rows.map((parsed) => {
			return parsed.line;
		})).toEqual([ 2, 5 ]);
	});

	test('marks a line with fewer than three columns and says how many it had', () => {
		const parsed = parseOne('17/07/2026\tBONIFICO ESTERO');

		expect(parsed).toMatchObject({ outcome: 'unreadable', refusal: { reason: 'columns', columns: 2 } });
	});

	test('does not let an unreadable row block the rows around it', () => {
		const rows = parseImportRows([ row('11/07/2026', 'UNO', '-1,00'), '17/07/2026\tBONIFICO ESTERO', row('12/07/2026', 'DUE', '2,00') ].join('\n'), ITALIAN);

		expect(rows.map((parsed) => {
			return parsed.outcome;
		})).toEqual([ 'read', 'unreadable', 'read' ]);
	});
});

describe('reading the date column', () => {
	test('reads a day the control’s order names', () => {
		expect(parseOne(row('11/07/2026', 'X', '1,00'), ITALIAN)).toMatchObject({ values: { date: '2026-07-11' } });
		expect(parseOne(row('07/11/2026', 'X', '1.00'), AMERICAN)).toMatchObject({ values: { date: '2026-07-11' } });
		expect(parseOne(row('2026-07-11', 'X', '1,00'), { ...ITALIAN, dateFormat: 'YYYY-MM-DD' })).toMatchObject({ values: { date: '2026-07-11' } });
	});

	test('takes “-” and “.” as separators too, the character carrying no meaning', () => {
		expect(parseOne(row('11-07-2026', 'X', '1,00'))).toMatchObject({ values: { date: '2026-07-11' } });
		expect(parseOne(row('11.07.2026', 'X', '1,00'))).toMatchObject({ values: { date: '2026-07-11' } });
	});

	test('refuses a two-digit year, a mixed pair of separators and anything that is not three numbers', () => {
		expect(refusalOf(row('11/07/26', 'X', '1,00'))).toBe('date');
		expect(refusalOf(row('11/07-2026', 'X', '1,00'))).toBe('date');
		expect(refusalOf(row('11 July 2026', 'X', '1,00'))).toBe('date');
		expect(refusalOf(row('lun 11/07/2026', 'X', '1,00'))).toBe('date');
		expect(refusalOf(row('11/07/2026 09:14', 'X', '1,00'))).toBe('date');
	});

	test('never rolls a part over into a neighbouring month or year', () => {
		expect(refusalOf(row('31/02/2026', 'X', '1,00'))).toBe('date');
		expect(refusalOf(row('11/13/2026', 'X', '1,00'))).toBe('date');
		expect(refusalOf(row('00/07/2026', 'X', '1,00'))).toBe('date');
	});

	test('reads the twenty-ninth of February in a leap year and refuses it in an ordinary one', () => {
		expect(parseOne(row('29/02/2024', 'X', '1,00'))).toMatchObject({ values: { date: '2024-02-29' } });
		expect(refusalOf(row('29/02/2025', 'X', '1,00'))).toBe('date');
	});

	test('refuses a day later than today, which is the paste saying the date control is wrong', () => {
		expect(refusalOf(row(tomorrow(), 'X', '1,00'))).toBe('futureDate');
	});
});

describe('reading the amount column', () => {
	test('reads zero, one and two decimals and refuses a third', () => {
		expect(readAmountOf('1234')).toBe(123400);
		expect(readAmountOf('1234,5')).toBe(123450);
		expect(readAmountOf('1234,56')).toBe(123456);
		expect(readAmountOf('1234,567')).toBeUndefined();
	});

	test('reads a thousands separator only where it groups the integer part in threes', () => {
		expect(readAmountOf('1.234.567,89')).toBe(123456789);
		expect(readAmountOf('1.234,56')).toBe(123456);
		expect(readAmountOf('1.2345')).toBeUndefined();
	});

	test('refuses a separator anywhere in the field once the control says there is none', () => {
		const none: ImportFormat = { ...ITALIAN, thousandsSeparator: 'none' };

		expect(readAmountOf('1234,56', none)).toBe(123456);
		expect(readAmountOf('1.234,56', none)).toBeUndefined();
	});

	test('reads an ordinary space as the separator when the control says so', () => {
		expect(readAmountOf('1 234,56', { ...ITALIAN, thousandsSeparator: 'space' })).toBe(123456);
	});

	test('refuses a field carrying the decimal character twice, whichever character it is', () => {
		expect(readAmountOf('1,234,56')).toBeUndefined();
		expect(readAmountOf('1.234.56', AMERICAN)).toBeUndefined();
	});

	test('swaps the readings when the two controls are flipped', () => {
		expect(readAmountOf('1.234,56')).toBe(123456);
		expect(readAmountOf('1,234.56')).toBeUndefined();
		expect(readAmountOf('1,234.56', AMERICAN)).toBe(123456);
		expect(readAmountOf('1.234,56', AMERICAN)).toBeUndefined();
	});

	test('takes a leading sign and no other way of stating one', () => {
		expect(readAmountOf('-54,80')).toBe(-5480);
		expect(readAmountOf('+54,80')).toBe(5480);
		expect(readAmountOf('54,80')).toBe(5480);
		expect(readAmountOf('54,80-')).toBeUndefined();
		expect(readAmountOf('(54,80)')).toBeUndefined();
		expect(readAmountOf('54,80 D')).toBeUndefined();
	});

	test('strips a € or EUR marker at either end and nothing else', () => {
		expect(readAmountOf('€ -54,80')).toBe(-5480);
		expect(readAmountOf('€-54,80')).toBe(-5480);
		expect(readAmountOf('-54,80 €')).toBe(-5480);
		expect(readAmountOf('-54,80 EUR')).toBe(-5480);
		expect(readAmountOf('-54,80 USD')).toBeUndefined();
	});

	test('takes the sign on either side of a leading marker, but not on both', () => {
		expect(readAmountOf('-€ 54,80')).toBe(-5480);
		expect(readAmountOf('-€54,80')).toBe(-5480);
		expect(readAmountOf('- €54,80')).toBe(-5480);
		expect(readAmountOf('- € 54,80')).toBe(-5480);
		expect(readAmountOf('-EUR 54,80')).toBe(-5480);
		expect(readAmountOf('+€ 54,80')).toBe(5480);
		expect(readAmountOf('-€ -54,80')).toBeUndefined();
		expect(readAmountOf('-€ +54,80')).toBeUndefined();
	});

	test('reads a zero amount, which is legal on both paths', () => {
		expect(readAmountOf('0,00')).toBe(0);
	});

	test('refuses an amount that is not a figure at all', () => {
		expect(refusalOf(row('11/07/2026', 'X', ''))).toBe('amount');
		expect(refusalOf(row('11/07/2026', 'X', 'saldo'))).toBe('amount');
	});
});

describe('the rest of what a row must carry', () => {
	test('refuses a description that trims to nothing', () => {
		expect(refusalOf(row('11/07/2026', '   ', '-54,80'))).toBe('description');
	});
});

describe('the rows the file already holds', () => {
	const existing = makeTransaction({ accountId: 'account-1', date: '2026-07-11', amount: -5480, description: 'PAGAMENTO  POS   Coop 2213' });

	const pasted = (description: string): readonly ImportRow[] => {
		return parseImportRows(row('11/07/2026', description, '-54,80'), ITALIAN);
	};

	test('matches on account, date, amount and a description compared trimmed, collapsed and case-folded', () => {
		const duplicates = findImportDuplicates({ rows: pasted('pagamento pos coop 2213'), transactions: [ existing ], accountId: 'account-1' });

		expect([ ...duplicates ]).toEqual([ 1 ]);
	});

	test('does not match a row of another account, nor one whose amount or day differs', () => {
		expect(findImportDuplicates({ rows: pasted('PAGAMENTO POS COOP 2213'), transactions: [ existing ], accountId: 'account-2' }).size).toBe(0);
		expect(findImportDuplicates({
			rows: parseImportRows(row('11/07/2026', 'PAGAMENTO POS COOP 2213', '-54,90'), ITALIAN),
			transactions: [ existing ],
			accountId: 'account-1'
		}).size).toBe(0);
	});

	test('never compares the rows of a paste with each other, so two of a kind are both flagged', () => {
		const rows = parseImportRows([ row('11/07/2026', 'PAGAMENTO POS COOP 2213', '-54,80'), row('11/07/2026', 'PAGAMENTO POS COOP 2213', '-54,80') ].join('\n'), ITALIAN);
		const duplicates = findImportDuplicates({ rows, transactions: [ existing ], accountId: 'account-1' });

		expect([ ...duplicates ]).toEqual([ 1, 2 ]);
		expect([ ...defaultImportSelection(rows, duplicates) ]).toEqual([]);
	});

	test('ticks every readable row that is not one of them, and never an unreadable one', () => {
		const rows = parseImportRows([ row('11/07/2026', 'UNO', '-1,00'), '17/07/2026\tBONIFICO ESTERO', row('12/07/2026', 'DUE', '2,00') ].join('\n'), ITALIAN);

		expect([ ...defaultImportSelection(rows, new Set<number>()) ]).toEqual([ 1, 3 ]);
	});
});

describe('what the ticked rows are written as', () => {
	const rows = parseImportRows([
		row('12/07/2026', 'ADDEBITO SDD ENEL ENERGIA', '-29,95'),
		row('11/07/2026', 'PAGAMENTO POS COOP 2213', '-54,80'),
		row('13/07/2026', 'PRELIEVO ATM', '-100,00')
	].join('\n'), ITALIAN);

	const imported = (selection: readonly number[]) => {
		return buildImportedTransactions({
			rows,
			selection: new Set(selection),
			accountId: 'account-1',
			transactions: [ makeTransaction({ insertionSeq: 7 }) ],
			rules: [ makeRule({ substring: 'ENEL', categoryId: 'electricity' }) ]
		});
	};

	test('keeps the pasted order and takes consecutive sequences in it', () => {
		const written = imported([ 1, 2, 3 ]);

		expect(written.map((transaction) => {
			return transaction.description;
		})).toEqual([ 'ADDEBITO SDD ENEL ENERGIA', 'PAGAMENTO POS COOP 2213', 'PRELIEVO ATM' ]);
		expect(written.map((transaction) => {
			return transaction.insertionSeq;
		})).toEqual([ 8, 9, 10 ]);
	});

	test('writes only the ticked rows, and theirs are consecutive among themselves', () => {
		expect(imported([ 1, 3 ]).map((transaction) => {
			return transaction.insertionSeq;
		})).toEqual([ 8, 9 ]);
	});

	test('arrives automatic, categorised by the rules the file holds, and with no receipt state', () => {
		const written = imported([ 1, 2 ]);

		expect(written[0]).toMatchObject({ categorySource: 'automatic', categoryId: 'electricity', receiptState: 'na', notes: '' });
		expect(written[1]).toMatchObject({ categorySource: 'automatic', categoryId: null, receiptState: 'na' });
	});

	test('covers the days it wrote, which is the period Transactions is handed', () => {
		expect(importedPeriod(imported([ 1, 2, 3 ]))).toEqual({ fromDate: '2026-07-11', toDate: '2026-07-13' });
		expect(importedPeriod([])).toBeUndefined();
	});
});
