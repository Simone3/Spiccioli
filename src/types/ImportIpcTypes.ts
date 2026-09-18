/**
 * What crosses the bridge when a file an import reads is read.
 *
 * The split is the one storage already keeps: **the main process owns the file and the renderer owns what it means**. What goes
 * out is a description of the bytes — which sheet, which delimiter, which encoding — and what comes back is **a grid of the
 * text the cells hold, exactly as the file holds it**. Nothing here knows what a column is for: which of them is a date and
 * which is an amount is the template's business, and the template lives in the renderer beside the parser that reads them
 * ([§5.7](../../docs/functional/specs/05-transactions.md#57-bulk-import)).
 *
 * **A figure crosses as the characters the file spells it with and never as a number.** A spreadsheet holds an amount as a
 * binary double, so parsing one here would put a rounding between the file and the import parser that [§8.2](../../docs/technical/08-decisions.md#82-what-d3-fixes)
 * names as the one conversion boundary. The literal text goes across and the boundary stays where it is.
 */

// Which sheet of a workbook the rows are on. A name where the export gives its sheet one, and the position otherwise.
export type SheetSelector = {
	by: 'name';
	name: string;
} | {
	by: 'index';

	// Counting from zero, in the order the workbook lists its sheets
	index: number;
};

// How the bytes become a grid, which is the whole of what the main process is told about a template
export type ImportSource = {
	kind: 'xlsx';
	sheet: SheetSelector;
} | {
	kind: 'csv';

	// One character, and the one the export separates its columns with: a comma here, a semicolon in most of Europe
	delimiter: string;

	// What the bytes spell text in. Bank exports are still written in the Windows code page more often than not.
	encoding: 'utf-8' | 'windows-1252';
} | {

	/**
	 * A document that prints its figures rather than tabulating them, which is what a payslip is.
	 *
	 * **There is nothing to declare.** A workbook has sheets and a delimited file has a delimiter; a PDF has neither, and the
	 * lines it prints are the whole of what crosses — one entry per line, holding the pieces of text along it.
	 */
	kind: 'pdf';
};

/**
 * Which import is asking, which is the whole of what the folder the chooser opens in is remembered under.
 *
 * **A payslip and a bank export do not live in the same folder**, so one memory shared between them would send every import
 * back to where the other one was taken from ([§5.7](../../docs/functional/specs/05-transactions.md#57-bulk-import)).
 */
export type ImportScope = 'transactions' | 'payslips';

export interface ReadImportFileRequest {
	source: ImportSource;

	// Which import is asking, which says which remembered folder the chooser opens in
	scope: ImportScope;

	// What the file chooser offers, named for the template rather than for the extension: "Excel workbook", "PDF document"
	fileTypeName: string;
	extensions: string[];

	// What the chooser's own title bar says
	dialogTitle: string;
}

/**
 * Why a file could not be turned into a grid at all. Every one of them is about the shape of the bytes and none of them is
 * about a row: a row the grid carries and the screen cannot read is not a refusal, it is a marked row in the preview.
 */
export type ImportFileRefusal = {

	// The bytes are not a workbook: not a zip, or a zip with no workbook in it
	reason: 'not-a-workbook';
} | {

	// The workbook carries no sheet under the name or at the position the template asked for
	reason: 'sheet-missing';

	// What was asked for, which is what makes the refusal legible
	sheet: string;
} | {

	// The bytes are not a PDF, or are one nothing can be opened out of: encrypted, truncated, or written to no standard at all
	reason: 'not-a-pdf';
} | {

	// The file is there and readable and holds no rows at all. A PDF whose text is a picture of text is this one too.
	reason: 'empty';
} | {

	// The file could not be read off the disk, or is larger than an export can be
	reason: 'unreadable';
};

export type ReadImportFileResult = {
	outcome: 'cancelled';
} | {
	outcome: 'read';

	// The file's own name, with the path it sits under left behind: the screen says which file it read and never where it was
	fileName: string;

	// One entry per row, each holding the text of its cells from the first column to the last one that carries anything
	rows: string[][];
} | {
	outcome: 'refused';
	refusal: ImportFileRefusal;
};

// What the preload publishes on "window.spiccioliImport"
export interface SpiccioliImportApi {

	// Opens the chooser and answers with the grid, which is one round trip because nothing in the window ever needs the path
	readFile: (request: ReadImportFileRequest) => Promise<ReadImportFileResult>;
}
