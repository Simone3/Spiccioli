import type { ImportSource } from 'src/types/ImportIpcTypes';
import type { ImportTemplate } from 'src/logic/import/ImportTemplate';

/**
 * The templates the application ships, which are the whole of what *Upload* offers.
 *
 * **A template is code and not configuration** ([§15](../../../docs/functional/specs/15-out-of-scope.md)): there is no editor,
 * no mapping screen and no template file on disk, and the way a new one arrives is a new version of the application. A mapping
 * the user can write is a mapping that can point *Amount* at the running-balance column, and the import that follows is
 * hundreds of rows that parse perfectly and are all wrong.
 *
 * **What a template is named is not here.** Every string a user reads lives in the translation bundle, so a template carries
 * an id and the screen looks its name up by it.
 */

// The one template v1 ships, and the shape the real ones are written against: a sheet with three headed columns and nothing
// above them. A date is a real date cell, so it arrives as the day count a spreadsheet holds one as; an amount is a real number
// cell, and a spreadsheet writes one of those with a dot and no grouping whatever the machine's own settings say.
const SAMPLE_TEMPLATE: ImportTemplate = {
	id: 'sample',
	source: { kind: 'xlsx', sheet: { by: 'index', index: 0 } },
	header: { by: 'labels', labels: [ 'Date', 'Description', 'Amount' ] },
	date: { column: { by: 'header', label: 'Date' }, cell: 'serial' },
	description: [ { by: 'header', label: 'Description' } ],
	amount: { kind: 'signed', column: { by: 'header', label: 'Amount' } },
	format: { dateFormat: 'DD/MM/YYYY', decimalSeparator: 'dot', thousandsSeparator: 'none' },
	stopAtBlankRow: true
};

export const IMPORT_TEMPLATES: readonly ImportTemplate[] = [ SAMPLE_TEMPLATE ];

/**
 * Finds a template by the id a picker hands back.
 * @param id The id.
 * @returns The template, or undefined where nothing ships under that id.
 */
export const findImportTemplate = (id: string): ImportTemplate | undefined => {
	return IMPORT_TEMPLATES.find((template) => {
		return template.id === id;
	});
};

/**
 * What the file chooser is allowed to offer for a template, which is the extension its export actually carries.
 * @param source What the template says its file is.
 * @returns The extensions, without their dots, as a chooser takes them.
 */
export const extensionsForImportSource = (source: ImportSource): string[] => {
	return source.kind === 'xlsx' ? [ 'xlsx' ] : [ 'csv' ];
};
