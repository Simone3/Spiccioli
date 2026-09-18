import { readAmount, type ImportNumberFormat } from 'src/logic/transactions/TransactionImport';
import type { ImportSource } from 'src/types/ImportIpcTypes';
import type { Cents } from 'src/types/LedgerTypes';

/**
 * What a payslip template is, and what applying one to the lines of a document produces.
 *
 * **A template states where each figure is printed; it never works it out.** Which line carries the period, which line carries
 * the gross and what the figures' separators mean are all declared, and a document that is not what the template says it is is
 * refused rather than read some other way. That is the rule the bank templates of [`ImportTemplate.ts`](ImportTemplate.ts) are
 * built on, over a document that prints its figures instead of tabulating them.
 *
 * **What applying one produces is a form that arrives filled in**, and never a payslip. Every figure it read goes into the
 * fields of the *Add payslip* form, where the user sees each one beside the label it belongs to and saves it themselves — so a
 * template that read a line wrong is caught where a wrong figure is visible, and nothing reaches the file that the form would
 * not have written ([§8.1](../../../docs/functional/specs/08-salaries.md#81-payslips)).
 *
 * **A figure the template did not find is left empty and is never guessed at.** The form asks for it like any other empty
 * field, and the screen says which ones they were: a payslip that prints no car allowance in a month with no car is the
 * ordinary case, and a zero written on the user's behalf would be a figure nobody typed.
 *
 * **The refusals here are about the document and not about a figure.** A period that is not there is a document this template
 * does not describe; a figure that is not there is a field left empty.
 */

/**
 * The figures a template may read, which are the eight amounts the payslip form asks for.
 *
 * The derived net salary is not among them: it is the one figure on that form that is never a field, being made of the three
 * above it ([§11.7](../../../docs/functional/specs/11-calculations.md#117-salary-figures)).
 */
export const PAYSLIP_FIGURES = [
	'contractGross',
	'gross',
	'netPayment',
	'refunds',
	'carPayment',
	'employeeContribution',
	'employerContribution',
	'severanceContribution'
] as const;

export type PayslipFigure = typeof PAYSLIP_FIGURES[number];

/**
 * Where the period a payslip is for is printed.
 *
 * **Both parts come out of one line**, that being how a payslip states a period: the month and the year are two capture groups
 * of one pattern rather than two lines that would have to be found separately and could disagree.
 */
export interface PayslipPeriod {
	pattern: RegExp;

	// Which capture group of the pattern holds each part, counting from one as a match does
	monthGroup: number;
	yearGroup: number;
}

/**
 * The templates the application ships, as a closed set: a template's id is what names it in the translation bundle, so adding
 * one is adding a name here and an entry beside it there.
 */
export const PAYSLIP_TEMPLATE_IDS = [ 'sample' ] as const;

export type PayslipTemplateId = typeof PAYSLIP_TEMPLATE_IDS[number];

export interface PayslipTemplate {
	id: PayslipTemplateId;

	// How the bytes become lines, which is the only part of a template the main process is told
	source: ImportSource;

	period: PayslipPeriod;

	/**
	 * Where a name for the payslip is printed, on a document that prints one: a *tredicesima* is a second December payslip and
	 * the label is what says so ([§8.1](../../../docs/functional/specs/08-salaries.md#81-payslips)). Its first capture group is
	 * the name. **A document that prints none simply leaves the field empty**, which is what an ordinary month is.
	 */
	label?: RegExp;

	/**
	 * Where each figure is printed: the line it sits on, with the figure itself as the first capture group.
	 *
	 * **A template may leave a figure out**, a payslip being free to print nothing at all under a heading it has no entry for.
	 * What it leaves out and what it looked for and did not find come to the same thing on the form: an empty field.
	 */
	figures: Partial<Record<PayslipFigure, RegExp>>;

	// What this document's figures look like, because a payslip is not obliged to write them the way this file does
	format: ImportNumberFormat;
}

/**
 * Why a document could not be read under the template that was chosen. Both of them say the document is not what the template
 * describes, and neither is about a figure.
 */
export type PayslipTemplateRefusal = {

	// The document prints no text at all, which is what a scan of a payslip is: a picture of one
	reason: 'no-text';
} | {

	// The line naming the period is not there, so this is not the document the template describes
	reason: 'period-missing';
};

// What a document was read as: the period it is for, the name it carries, and every figure that was found on it
export interface PayslipImportValues {
	year: number;
	month: number;

	// The name the document printed, or null where it printed none
	label: string | null;

	figures: Partial<Record<PayslipFigure, Cents>>;
}

export type ApplyPayslipTemplateResult = {
	outcome: 'read';
	values: PayslipImportValues;

	// The figures the template looked for and did not come back with, which are the fields the form opens empty
	missing: readonly PayslipFigure[];
} | {
	outcome: 'refused';
	refusal: PayslipTemplateRefusal;
};

const WHITESPACE_RUN = /\s+/gu;

// The twelve months, which is what a period's month has to be one of before anything is read under it
const MONTH_RANGE = { minimum: 1, maximum: 12 };

// The four digits a year is written with, the same rule the import's dates are read under ([§5.7])
const YEAR_DIGITS = /^\d{4}$/u;

const MONTH_DIGITS = /^\d{1,2}$/u;

/**
 * Puts one printed line back together as the text a template matches against.
 *
 * **The pieces are joined with one space and the whitespace is collapsed**, because where a document breaks a line into pieces
 * is a fact about how it was typeset and not about what it says: a heading printed as three pieces and one printed whole have
 * to match the same pattern.
 * @param line The pieces of text along the line, left to right.
 * @returns The line as one string.
 */
export const payslipLineText = (line: readonly string[]): string => {
	return line.join(' ').trim().replace(WHITESPACE_RUN, ' ');
};

/**
 * Finds the first line the pattern matches, and hands back the match.
 * @param lines The document.
 * @param pattern What is being looked for.
 * @returns The match, or undefined where no line carries one.
 */
const firstMatch = (lines: readonly string[], pattern: RegExp): RegExpExecArray | undefined => {
	for(const line of lines) {
		const match = pattern.exec(line);

		if(match) {
			return match;
		}
	}

	return undefined;
};

/**
 * Reads the period the document is for.
 * @param lines The document.
 * @param period Where the template says it is printed.
 * @returns The month and the year, or undefined where the line is not there or does not say them.
 */
const readPeriod = (lines: readonly string[], period: PayslipPeriod): { year: number; month: number } | undefined => {
	const match = firstMatch(lines, period.pattern);

	if(!match) {
		return undefined;
	}

	const monthText = (match[period.monthGroup] ?? '').trim();
	const yearText = (match[period.yearGroup] ?? '').trim();

	if(!MONTH_DIGITS.test(monthText) || !YEAR_DIGITS.test(yearText)) {
		return undefined;
	}

	const month = Number(monthText);

	// A month outside the twelve is a line that matched something it was not meant to, and is the same as not finding one
	return month < MONTH_RANGE.minimum || month > MONTH_RANGE.maximum ? undefined : { year: Number(yearText), month };
};

/**
 * Reads a document under one template.
 *
 * **What comes back is what the document said and nothing more.** A figure whose line is not there, and a figure whose line is
 * there and carries something the amount parser cannot read, are both reported as missing and both leave the form's field
 * empty — the document is the only thing that fills one in.
 * @param lines The document, one entry per printed line holding the pieces of text along it.
 * @param template The template the user chose.
 * @returns The values the form opens on, or why the document could not be read at all.
 */
export const applyPayslipTemplate = (lines: readonly string[][], template: PayslipTemplate): ApplyPayslipTemplateResult => {
	const text = lines.map(payslipLineText).filter((line) => {
		return line !== '';
	});

	if(text.length === 0) {
		return { outcome: 'refused', refusal: { reason: 'no-text' } };
	}

	const period = readPeriod(text, template.period);

	if(!period) {
		return { outcome: 'refused', refusal: { reason: 'period-missing' } };
	}

	const figures: Partial<Record<PayslipFigure, Cents>> = {};
	const missing: PayslipFigure[] = [];

	PAYSLIP_FIGURES.forEach((figure) => {
		const pattern = template.figures[figure];
		const match = pattern === undefined ? undefined : firstMatch(text, pattern);
		const amount = match === undefined ? undefined : readAmount((match[1] ?? '').trim(), template.format);

		if(amount === undefined) {
			missing.push(figure);

			return;
		}

		figures[figure] = amount;
	});

	const labelMatch = template.label === undefined ? undefined : firstMatch(text, template.label);
	const label = (labelMatch?.[1] ?? '').trim();

	return { outcome: 'read', values: { ...period, label: label === '' ? null : label, figures }, missing };
};
