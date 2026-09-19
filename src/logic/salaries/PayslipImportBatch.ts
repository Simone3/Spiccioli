import { applyPayslipTemplate, payslipLinesOf, PAYSLIP_FIGURES, type PayslipFigure, type PayslipLabels, type PayslipTemplate } from 'src/logic/import/PayslipTemplate';
import { isMonthInContract } from 'src/logic/salaries/Contracts';
import type { ImportFileOutcome, ImportFileRefusal } from 'src/types/ImportIpcTypes';
import type { Contract, LedgerId, Payslip } from 'src/types/LedgerTypes';

/**
 * A selection of payslip documents turned into the rows the recap of [§8.1](../../../docs/functional/specs/08-salaries.md#81-payslips)
 * ticks and writes.
 *
 * **Every document gets a row and no document takes another one down with it.** A scan among twelve payslips, a document this
 * template does not describe and a payslip for a year the contract never covered are each one marked row, which is the rule the
 * bulk import's unreadable rows already follow ([§5.7](../../../docs/functional/specs/05-transactions.md#57-bulk-import)).
 *
 * **A figure the template did not find is a zero here.** It is the one place in the application a figure nobody typed is
 * written, and it is what a recap with nothing to type into costs: the row says which of its figures they were, the recap names
 * them above the table, and one that should have been something else is corrected on the row's own form once it is written.
 * **`gross` and `contractGross` are the exception** — [§13](../../../docs/functional/specs/13-validation.md) refuses a zero in
 * either, so there is nothing to stand in for what was not printed and the row cannot be ticked at all.
 *
 * **A duplicate is flagged and never refused.** A month legitimately holds more than one payslip, so a row matching one already
 * in the file — or an earlier row of the same selection — arrives unticked and can be ticked again. It is what makes a folder
 * imported twice safe, and nothing here matches a row on anything but the four fields a payslip is found by.
 */

// The two figures a payslip may not carry a zero in, so a document that printed neither has nothing to stand in for them
export const PAYSLIP_REQUIRED_FIGURES: readonly PayslipFigure[] = [ 'contractGross', 'gross' ];

// What a row would write, which is the payslip record without the two fields the screen carries for it
export type PayslipBatchValues = Omit<Payslip, 'id' | 'contractId'>;

// The period a row is ordered by, which a refused row has wherever the document said what it was for
export interface PayslipBatchPeriod {
	year: number;
	month: number;
	label: string | null;
}

/**
 * Why a document cannot be written.
 *
 * **The first is about the file and the rest are about the payslip.** A document nothing could be opened out of never reached
 * the template; the others were read and are refused on what they said.
 */
export type PayslipBatchRefusal = {
	reason: 'file';
	refusal: ImportFileRefusal;
} | {
	reason: 'no-text';
} | {
	reason: 'period-missing';
} | {
	reason: 'year-outside-contract';
	year: number;
} | {
	reason: 'month-outside-contract';
} | {

	// The document printed neither gross, and a zero is not a value either of them may take
	reason: 'gross-missing';
	figures: readonly PayslipFigure[];
};

// Whether a row would write a payslip that is there already, and where the one it matches was found
export type PayslipBatchDuplicate = 'none' | 'file' | 'selection';

/**
 * One document of the selection.
 *
 * **The key is the position in the selection** and never the file's name: two documents of one name are two rows, and a row's
 * identity may not change when the rows are ordered.
 */
export type PayslipBatchRow = {
	key: string;
	fileName: string;
} & ({
	outcome: 'read';
	values: PayslipBatchValues;

	// The figures the document did not print, which are the ones this row writes as zeros
	zeroed: readonly PayslipFigure[];
	duplicate: PayslipBatchDuplicate;
} | {
	outcome: 'refused';
	refusal: PayslipBatchRefusal;

	// What the document said it was for, where it said anything: a row with none of this sits at the end of the recap
	period: PayslipBatchPeriod | undefined;
});

export interface PayslipBatchOptions {

	// The documents, as the main process read them, in the order the chooser handed them over
	files: readonly ImportFileOutcome[];

	// The one template the whole selection is read under
	template: PayslipTemplate;

	// What a payslip the document names is called, which is wording and never the document's own shorthand
	labels: PayslipLabels;

	// The contract the screen is scoped to, whose life every month has to fall inside
	contract: Contract;

	// The years the per-year table has rows for, which are the only years a payslip has anywhere to land in
	years: readonly number[];

	// The payslips already in the file, which is what the first kind of duplicate is flagged against
	existing: readonly Payslip[];
}

// A label is matched the way two of anything are matched in this application: trimmed, collapsed and case-folded
const WHITESPACE_RUN = /\s+/gu;

/**
 * The four fields a payslip is found by, as one key.
 * @param contractId The contract it is under.
 * @param period The period and the label.
 * @returns The key.
 */
const duplicateKey = (contractId: LedgerId, period: PayslipBatchPeriod): string => {
	const label = (period.label ?? '').trim().replace(WHITESPACE_RUN, ' ').toLowerCase();

	return JSON.stringify([ contractId, period.year, period.month, label ]);
};

/**
 * Orders the rows the way the payslip table orders its own: by year, then month, then label with the unlabelled row first.
 *
 * **A document with nothing to order by sits at the end**, in the order it was chosen — a scan says nothing about which month
 * it was a scan of, and a row moved somewhere it cannot explain is worse than a row at the bottom.
 * @param rows The rows, in the order the documents were chosen.
 * @returns The rows, ordered.
 */
const orderRows = (rows: readonly PayslipBatchRow[]): PayslipBatchRow[] => {
	const periodOf = (row: PayslipBatchRow): PayslipBatchPeriod | undefined => {
		return row.outcome === 'read' ? row.values : row.period;
	};

	// The position in the selection, which is what every tie is broken by and what the periodless rows keep their order under
	const chosenAt = (row: PayslipBatchRow): number => {
		return Number(row.key);
	};

	return [ ...rows ].sort((first, second) => {
		const firstPeriod = periodOf(first);
		const secondPeriod = periodOf(second);

		if(!firstPeriod || !secondPeriod) {
			if(Boolean(firstPeriod) !== Boolean(secondPeriod)) {
				return firstPeriod ? -1 : 1;
			}

			return chosenAt(first) - chosenAt(second);
		}

		if(firstPeriod.year !== secondPeriod.year) {
			return firstPeriod.year - secondPeriod.year;
		}

		if(firstPeriod.month !== secondPeriod.month) {
			return firstPeriod.month - secondPeriod.month;
		}

		const firstLabel = firstPeriod.label ?? '';
		const secondLabel = secondPeriod.label ?? '';

		if(firstLabel !== secondLabel) {
			// The unlabelled row is first, an empty label sorting before every other one
			return firstLabel < secondLabel ? -1 : 1;
		}

		return chosenAt(first) - chosenAt(second);
	});
};

/**
 * Reads one document under the template and says what writing it would do.
 * @param file The document, as the main process read it.
 * @param key Its position in the selection.
 * @param options Everything the selection is read against.
 * @returns The row, before the duplicates are flagged on it.
 */
const readRow = (file: ImportFileOutcome, key: string, options: PayslipBatchOptions): PayslipBatchRow => {
	const named = { key, fileName: file.fileName };

	if(file.outcome === 'refused') {
		return { ...named, outcome: 'refused', refusal: { reason: 'file', refusal: file.refusal }, period: undefined };
	}

	const applied = applyPayslipTemplate(payslipLinesOf(file.rows, file.positions), options.template, options.labels);

	if(applied.outcome === 'refused') {
		return { ...named, outcome: 'refused', refusal: { reason: applied.refusal.reason }, period: undefined };
	}

	const period: PayslipBatchPeriod = {
		year: applied.values.year,
		month: applied.values.month,
		label: applied.values.label
	};

	// The year picker holds the contract's own years, so a document from outside them has no row to land in
	if(!options.years.includes(period.year)) {
		return { ...named, outcome: 'refused', refusal: { reason: 'year-outside-contract', year: period.year }, period };
	}

	if(!isMonthInContract(options.contract, period.year, period.month)) {
		return { ...named, outcome: 'refused', refusal: { reason: 'month-outside-contract' }, period };
	}

	const missingGross = PAYSLIP_REQUIRED_FIGURES.filter((figure) => {
		return applied.values.figures[figure] === undefined;
	});

	if(missingGross.length > 0) {
		return { ...named, outcome: 'refused', refusal: { reason: 'gross-missing', figures: missingGross }, period };
	}

	// Everything the document did not print, written as the zero this is the one place in the application to write
	const figures = Object.fromEntries(PAYSLIP_FIGURES.map((figure) => {
		return [ figure, applied.values.figures[figure] ?? 0 ];
	})) as Record<PayslipFigure, number>;

	return {
		...named,
		outcome: 'read',
		values: { ...period, ...figures, notes: '' },
		zeroed: applied.missing,
		duplicate: 'none'
	};
};

/**
 * Whether a row would write a payslip that is there already, and where the one it matches was found.
 * @param key The four fields the payslip would be written under.
 * @param alreadyThere What the file holds.
 * @param written What the rows above this one would write.
 * @returns Which of the two it is, or that it is neither.
 */
const duplicateOf = (key: string, alreadyThere: ReadonlySet<string>, written: ReadonlySet<string>): PayslipBatchDuplicate => {
	if(alreadyThere.has(key)) {
		return 'file';
	}

	return written.has(key) ? 'selection' : 'none';
};

/**
 * Turns a selection of documents into the rows the recap shows.
 * @param options The documents, the template they are read under, and the contract they are read against.
 * @returns One row per document, ordered the way the payslip table orders its own.
 */
export const buildPayslipBatch = (options: PayslipBatchOptions): readonly PayslipBatchRow[] => {
	const alreadyThere = new Set(options.existing.filter((payslip) => {
		return payslip.contractId === options.contract.id;
	}).map((payslip) => {
		return duplicateKey(payslip.contractId, payslip);
	}));

	// What the rows before this one would write, which is the second kind of duplicate: one document chosen twice
	const written = new Set<string>();

	const rows = options.files.map((file, position): PayslipBatchRow => {
		const row = readRow(file, String(position), options);

		if(row.outcome !== 'read') {
			return row;
		}

		const key = duplicateKey(options.contract.id, row.values);
		const duplicate = duplicateOf(key, alreadyThere, written);

		written.add(key);

		return { ...row, duplicate };
	});

	return orderRows(rows);
};

/**
 * Whether a row would write anything, which is what a tick box is offered for.
 * @param row The row.
 * @returns Whether it can be written.
 */
export const isWritablePayslipRow = (row: PayslipBatchRow): boolean => {
	return row.outcome === 'read';
};

/**
 * The rows a recap arrives with ticked: everything that can be written and is not a duplicate.
 *
 * **A duplicate is unticked and not untickable**, so this says where the selection starts and not what it is limited to.
 * @param rows The rows of the selection.
 * @returns The keys that arrive ticked.
 */
export const defaultPayslipSelection = (rows: readonly PayslipBatchRow[]): ReadonlySet<string> => {
	return new Set(rows.filter((row) => {
		return row.outcome === 'read' && row.duplicate === 'none';
	}).map((row) => {
		return row.key;
	}));
};
