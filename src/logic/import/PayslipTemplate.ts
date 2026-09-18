import { readAmount, type ImportNumberFormat } from 'src/logic/transactions/TransactionImport';
import type { ImportSource } from 'src/types/ImportIpcTypes';
import type { Cents } from 'src/types/LedgerTypes';

/**
 * What a payslip template is, and what applying one to the lines of a document produces.
 *
 * **A template states where each figure is printed; it never works it out.** Which line carries the period, which box carries
 * the gross and what the figures' separators mean are all declared, and a document that is not what the template says it is is
 * refused rather than read some other way. That is the rule the bank templates of [`ImportTemplate.ts`](ImportTemplate.ts) are
 * built on, over a document that prints its figures instead of tabulating them.
 *
 * **A payslip is a form of boxes, and a box is found by its heading and not by its line.** A payroll form prints a line of
 * headings and a line of figures under it, so the words naming a figure are nowhere near it in the text — and two figures under
 * two different headings are printed identically. A deduction and a credit on the same printed line are told apart by one thing
 * only: which column each of them sits in. So a template names the heading, the column it opens is measured off the heading
 * line, and the figure is the one printed inside it ([`PdfText.ts`](../../main/import/PdfText.ts) is what carries the points
 * across).
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
 * One piece of text along a printed line: what it says, and where it starts across the page.
 *
 * **The point is in the points a PDF measures in**, which is the unit it crossed the bridge in. Nothing here compares one
 * against a constant: a column is the distance between two headings of the document itself, so a form printed at another size
 * is read by the same template.
 */
export interface PayslipPiece {
	text: string;
	x: number;
}

// One printed line, as its pieces from left to right
export type PayslipLine = readonly PayslipPiece[];

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

	/**
	 * Which of the twelve each name the period line can carry is, for a document that names its period rather than numbering
	 * it. Left out, the month is read as digits.
	 *
	 * **A payroll form written for one country prints the month in that country's language**, and which of the twelve
	 * `SETTEMBRE` is is a fact about the document rather than about the reader — so the template states it, the same way it
	 * states its separators.
	 *
	 * **More than one name may be the same month**, because a form names an extra payment after the payment and not after the
	 * month it falls in: a *tredicesima*'s period box says `13a MENS.` where an ordinary December's says `DICEMBRE`, and
	 * [§8.1](../../../docs/functional/specs/08-salaries.md#81-payslips) files it as a second December payslip with a label
	 * rather than as a thirteenth month. **Which month it lands in is stated here and what it is called is not**: the label is
	 * read off the document by `label` below, like every other label, so nothing here writes words of its own onto a payslip.
	 */
	monthNames?: Readonly<Record<string, number>>;
}

/**
 * Where one figure is printed.
 *
 * **Both shapes name a heading and read a column off it**, because on a payroll form the heading is the only thing that says
 * what a figure is. They differ in which line the figure is on: a box prints it under its own heading, and a table prints one
 * line per entry, each naming itself.
 */
export type PayslipFigureSource = {

	/**
	 * A figure with a box of its own: the heading is printed on one line and the figure under it on the next line that carries
	 * figures at all.
	 *
	 * **The lines between the two are the heading's own.** A payroll form breaks a long heading over two lines, and a line that
	 * carries no figure anywhere along it is one of those rather than the row of values — so it is stepped over instead of being
	 * read as an empty box.
	 */
	in: 'box';

	// The heading, matched against one piece of a line. The column it opens runs to wherever the next heading on it starts.
	heading: RegExp;
} | {

	// A figure printed as one line of the document's table, found by the label that line carries
	in: 'table';

	/**
	 * Which lines of the table are this figure's, matched against the whole text of the line.
	 *
	 * **Every line that matches is summed**, because a figure the form asks for once is a figure the document is free to print
	 * twice: a withholding for the car and a charge for a fine are two lines and one field. **A line that matches and carries
	 * nothing readable in the column makes the whole figure missing** rather than a sum of the rest of them — a total short of
	 * one of its parts is a wrong figure, and an empty field is not.
	 */
	label: RegExp;

	// Which column of the table the figure is in, matched against one piece of the table's heading line
	column: RegExp;
};

/**
 * The templates the application ships, as a closed set: a template's id is what names it in the translation bundle, so adding
 * one is adding a name here and an entry beside it there.
 */
export const PAYSLIP_TEMPLATE_IDS = [ 'reply-italy' ] as const;

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
	 * The heading that names the document's table of entries, on a document that prints one.
	 *
	 * **It is declared once and not once per figure.** A form has one such table, every figure read out of it is read against
	 * the same columns, and stating it in one place is what keeps the eight figures below from disagreeing about where the table
	 * is.
	 */
	table?: RegExp;

	/**
	 * Where each figure is printed.
	 *
	 * **A template may leave a figure out**, a payslip being free to print nothing at all under a heading it has no entry for.
	 * What it leaves out and what it looked for and did not find come to the same thing on the form: an empty field.
	 */
	figures: Partial<Record<PayslipFigure, PayslipFigureSource>>;

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
 * A column of a printed form: where it starts across the page and where the next heading starts.
 *
 * **Both ends come off the heading line and neither is a constant.** A figure is inside its column when it starts at or after
 * its own heading and before the next one — which is what a right-aligned figure under a left-aligned heading does, and what
 * every payroll form this reads is typeset as.
 */
interface PayslipColumn {
	from: number;
	to: number;
}

/**
 * Puts one printed line back together as the text a pattern matches against.
 *
 * **The pieces are joined with one space and the whitespace is collapsed**, because where a document breaks a line into pieces
 * is a fact about how it was typeset and not about what it says: a heading printed as three pieces and one printed whole have
 * to match the same pattern.
 * @param line The pieces of text along the line, left to right.
 * @returns The line as one string.
 */
export const payslipLineText = (line: PayslipLine): string => {
	return line.map((piece) => {
		return piece.text;
	}).join(' ').trim().replace(WHITESPACE_RUN, ' ');
};

/**
 * Puts the two arrays a read hands back together into the lines a template is applied to.
 *
 * **A row with no positions beside it is a row of a grid and not a printed line**, and it comes through with every piece at the
 * start of the page: nothing is invented, and a template looking for a column finds nothing rather than something.
 * @param rows The text of each line, piece by piece.
 * @param positions Where each of those pieces starts across the page.
 * @returns The lines.
 */
export const payslipLinesOf = (rows: readonly string[][], positions: readonly number[][] | undefined): PayslipLine[] => {
	return rows.map((row, index) => {
		return row.map((text, piece) => {
			return { text, x: positions?.[index]?.[piece] ?? 0 };
		});
	});
};

/**
 * The first token of a piece of text, which is what a figure is when the document runs two boxes into one piece.
 *
 * **A page states where a piece begins and nothing about where it ends**, and a form that prints two neighbouring boxes close
 * enough together hands them over as one piece. The piece starts in the column that was asked for, so the figure that column
 * holds is the first thing on it and whatever follows belongs to the box after it.
 * @param text The piece.
 * @returns Everything up to the first space.
 */
const firstToken = (text: string): string => {
	return text.trim().split(WHITESPACE_RUN)[0] ?? '';
};

/**
 * Finds the first line the pattern matches, and hands back the match.
 * @param texts The document, one line of text per entry.
 * @param pattern What is being looked for.
 * @returns The match, or undefined where no line carries one.
 */
const firstMatch = (texts: readonly string[], pattern: RegExp): RegExpExecArray | undefined => {
	for(const text of texts) {
		const match = pattern.exec(text);

		if(match) {
			return match;
		}
	}

	return undefined;
};

/**
 * Measures the column a heading opens on the line it is printed on.
 *
 * **The column ends at the next heading along the line**, wherever that is, and at the edge of the page where the heading is
 * the last one. The next heading is looked for by position rather than by order, so a document that hands its pieces over in
 * some order of its own is measured the same way.
 * @param line The heading line.
 * @param heading Which heading on it.
 * @returns The column, or undefined where the line carries no such heading.
 */
const columnOf = (line: PayslipLine, heading: RegExp): PayslipColumn | undefined => {
	const found = line.find((piece) => {
		return heading.test(piece.text);
	});

	if(found === undefined) {
		return undefined;
	}

	const next = line.reduce<number>((nearest, piece) => {
		return piece.x > found.x && piece.x < nearest ? piece.x : nearest;
	}, Number.POSITIVE_INFINITY);

	return { from: found.x, to: next };
};

/**
 * Finds the line a heading is printed on and the column it opens there.
 * @param lines The document.
 * @param heading What is being looked for.
 * @returns Where the heading line is and what it opens, or undefined where the document carries no such heading.
 */
const headingColumn = (lines: readonly PayslipLine[], heading: RegExp): { line: number; column: PayslipColumn } | undefined => {
	for(const [ index, line ] of lines.entries()) {
		const column = columnOf(line, heading);

		if(column !== undefined) {
			return { line: index, column };
		}
	}

	return undefined;
};

/**
 * Reads the figure printed inside one column of one line.
 * @param line The line.
 * @param column The column.
 * @param format What the document's figures look like.
 * @returns The amount, or undefined where the column holds nothing this reads as one.
 */
const amountIn = (line: PayslipLine, column: PayslipColumn, format: ImportNumberFormat): Cents | undefined => {
	const inside = line.find((piece) => {
		return piece.x >= column.from && piece.x < column.to;
	});

	return inside === undefined ? undefined : readAmount(firstToken(inside.text), format);
};

/**
 * Says whether a line carries a figure anywhere along it, which is what tells a row of values from a heading over two lines.
 * @param line The line.
 * @param format What the document's figures look like.
 * @returns Whether anything on it reads as an amount.
 */
const carriesAmount = (line: PayslipLine, format: ImportNumberFormat): boolean => {
	return line.some((piece) => {
		return readAmount(firstToken(piece.text), format) !== undefined;
	});
};

/**
 * Reads a figure printed in a box of its own.
 * @param lines The document.
 * @param heading The heading naming the box.
 * @param format What the document's figures look like.
 * @returns The amount, or undefined where the heading is not there or the box under it is empty.
 */
const boxFigure = (lines: readonly PayslipLine[], heading: RegExp, format: ImportNumberFormat): Cents | undefined => {
	const found = headingColumn(lines, heading);

	if(found === undefined) {
		return undefined;
	}

	for(const line of lines.slice(found.line + 1)) {
		if(carriesAmount(line, format)) {
			return amountIn(line, found.column, format);
		}
	}

	return undefined;
};

/**
 * Reads a figure printed as one or more lines of the document's table.
 * @param lines The document.
 * @param table The heading naming the table, where the template declares one.
 * @param source Which lines of it and which column.
 * @param format What the document's figures look like.
 * @returns The sum of every line that matched, or undefined where none did or one of them could not be read.
 */
const tableFigure = (
	lines: readonly PayslipLine[],
	table: RegExp | undefined,
	source: Extract<PayslipFigureSource, { in: 'table' }>,
	format: ImportNumberFormat
): Cents | undefined => {
	if(table === undefined) {
		return undefined;
	}

	const heading = headingColumn(lines, table);

	if(heading === undefined) {
		return undefined;
	}

	const column = columnOf(lines[heading.line], source.column);

	if(column === undefined) {
		return undefined;
	}

	let total: Cents | undefined;

	for(const line of lines.slice(heading.line + 1)) {
		if(!source.label.test(payslipLineText(line))) {
			continue;
		}

		const amount = amountIn(line, column, format);

		// A line of this figure's that carries nothing readable is the figure, not a part of it that can be left out
		if(amount === undefined) {
			return undefined;
		}

		total = (total ?? 0) + amount;
	}

	return total;
};

/**
 * Reads one figure under whichever of the two shapes the template declared for it.
 * @param lines The document.
 * @param template The template.
 * @param figure Which of the eight.
 * @returns The amount, or undefined where the template names nowhere for it or the document printed nothing there.
 */
const figureOf = (lines: readonly PayslipLine[], template: PayslipTemplate, figure: PayslipFigure): Cents | undefined => {
	const source = template.figures[figure];

	if(source === undefined) {
		return undefined;
	}

	if(source.in === 'box') {
		return boxFigure(lines, source.heading, template.format);
	}

	return tableFigure(lines, template.table, source, template.format);
};

/**
 * Reads a month the document numbered.
 * @param text What the period line said the month was.
 * @returns The month, or undefined where it is not digits.
 */
const readNumberedMonth = (text: string): number | undefined => {
	return MONTH_DIGITS.test(text) ? Number(text) : undefined;
};

/**
 * Reads a month the document named.
 *
 * **The names are matched without regard to case**, a form being free to print the same name in capitals in one box and in
 * small letters in another, and none of the twelve differing from another by case alone.
 * @param text What the period line said the month was.
 * @param names Which of the twelve each name the template listed is.
 * @returns The month, or undefined where the template lists no such name.
 */
const readNamedMonth = (text: string, names: Readonly<Record<string, number>>): number | undefined => {
	const found = Object.entries(names).find(([ name ]) => {
		return name.toUpperCase() === text.toUpperCase();
	});

	return found?.[1];
};

/**
 * Reads the period the document is for.
 * @param texts The document, one line of text per entry.
 * @param period Where the template says it is printed.
 * @returns The month and the year, or undefined where the line is not there or does not say them.
 */
const readPeriod = (texts: readonly string[], period: PayslipPeriod): { year: number; month: number } | undefined => {
	const match = firstMatch(texts, period.pattern);

	if(!match) {
		return undefined;
	}

	const monthText = (match[period.monthGroup] ?? '').trim();
	const yearText = (match[period.yearGroup] ?? '').trim();

	if(!YEAR_DIGITS.test(yearText)) {
		return undefined;
	}

	const month = period.monthNames === undefined ? readNumberedMonth(monthText) : readNamedMonth(monthText, period.monthNames);

	// A month the document does not name, or one outside the twelve, is a line that matched something it was not meant to —
	// which is the same as not finding one at all
	if(month === undefined || month < MONTH_RANGE.minimum || month > MONTH_RANGE.maximum) {
		return undefined;
	}

	return { year: Number(yearText), month };
};

/**
 * Reads a document under one template.
 *
 * **What comes back is what the document said and nothing more.** A figure whose heading is not there, and a figure whose box
 * is there and holds something the amount parser cannot read, are both reported as missing and both leave the form's field
 * empty — the document is the only thing that fills one in.
 * @param lines The document, one entry per printed line holding the pieces of text along it.
 * @param template The template the user chose.
 * @returns The values the form opens on, or why the document could not be read at all.
 */
export const applyPayslipTemplate = (lines: readonly PayslipLine[], template: PayslipTemplate): ApplyPayslipTemplateResult => {
	const printed = lines.filter((line) => {
		return payslipLineText(line) !== '';
	});

	if(printed.length === 0) {
		return { outcome: 'refused', refusal: { reason: 'no-text' } };
	}

	const texts = printed.map(payslipLineText);
	const period = readPeriod(texts, template.period);

	if(!period) {
		return { outcome: 'refused', refusal: { reason: 'period-missing' } };
	}

	const figures: Partial<Record<PayslipFigure, Cents>> = {};
	const missing: PayslipFigure[] = [];

	PAYSLIP_FIGURES.forEach((figure) => {
		const amount = figureOf(printed, template, figure);

		if(amount === undefined) {
			missing.push(figure);

			return;
		}

		figures[figure] = amount;
	});

	const labelMatch = template.label === undefined ? undefined : firstMatch(texts, template.label);
	const label = (labelMatch?.[1] ?? '').trim();

	return { outcome: 'read', values: { ...period, label: label === '' ? null : label, figures }, missing };
};
