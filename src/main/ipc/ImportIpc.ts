import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { BrowserWindow, Dialog, IpcMain } from 'electron';
import { IMPORT_FILE_CONFIG } from 'src/config/AppConfig';
import { appLogger } from 'src/framework/main/logging/AppLogger';
import { decodeDelimitedText, parseDelimitedRows } from 'src/main/import/DelimitedGrid';
import { readPdfLines } from 'src/main/import/PdfText';
import { readXlsxGrid } from 'src/main/import/XlsxGrid';
import { SPICCIOLI_IMPORT_IPC_CHANNELS } from 'src/types/ImportIpcChannels';
import type {
	ImportFileOutcome,
	ImportScope,
	ImportSource,
	ReadImportFileRequest,
	ReadImportFileResult,
	ReadImportFilesResult
} from 'src/types/ImportIpcTypes';

/**
 * The renderer's way to a file an import reads, and the only one there is.
 *
 * **One round trip does the whole of it**: the chooser opens, the bytes are read, and a grid of cell text comes back. The path
 * never crosses, because nothing in the window has anything to do with one — the file is read here and is not opened again.
 *
 * **Nothing here knows what a column is for.** Which of them carries a date and which carries an amount is the template's
 * business and the template is the renderer's, so what this answers with is the text the cells hold and no reading of it. A
 * printed document has no cells at all, so the point each piece of a line starts at crosses beside the text and is read by the
 * payslip template and by nothing before it.
 *
 * **What it writes to the log is a path, a count and a reason, and never a cell** ([§8.4](../../../docs/technical/08-decisions.md#84-what-d14-logs)):
 * an export is somebody's spending, line by line, and the log is the one place in the application it must not reach.
 */

type ImportIpcMain = Pick<IpcMain, 'handle'>;

type ImportDialog = Pick<Dialog, 'showOpenDialog'>;

// What one file comes back as, which is everything a read answers with except the answer for a chooser nobody chose anything in
type ReadFileOutcome = Exclude<ReadImportFileResult, { outcome: 'cancelled' }>;

export interface RegisterImportIpcHandlersOptions {
	ipcMain: ImportIpcMain;
	dialog: ImportDialog;

	// The window the chooser is attached to, so that it opens as a sheet rather than as a separate window
	getWindow: () => BrowserWindow | undefined;

	/**
	 * Where the chooser opens the **first** time it is opened in a run, which is the downloads folder: a bank export has just
	 * been downloaded, so that is where it is. Every later import opens where the last one was taken from instead.
	 */
	initialDirectory: () => string;

	// Reading the file off the disk, injected so that the handler is testable without one
	readFile?: (filePath: string) => Buffer;

	// How large the file is, asked before it is read so that nothing enormous is pulled into memory to be refused afterwards
	fileSize?: (filePath: string) => number;
}

/**
 * Turns the bytes into a grid under the source the template declared.
 * @param bytes The whole file.
 * @param source What the template says the bytes are.
 * @returns The grid, or why there is none. Never *cancelled*: bytes that are here were chosen.
 */
const readGrid = async(bytes: Buffer, source: ImportSource): Promise<ReadFileOutcome | { outcome: 'grid'; rows: string[][]; positions?: number[][] }> => {
	if(source.kind === 'csv') {
		return { outcome: 'grid', rows: parseDelimitedRows(decodeDelimitedText(bytes, source.encoding), source.delimiter) };
	}

	if(source.kind === 'pdf') {
		const document = await readPdfLines(bytes);

		if(document.outcome !== 'lines') {
			return { outcome: 'refused', refusal: { reason: 'not-a-pdf' } };
		}

		// The text and the points it is printed at, taken apart into the two arrays that cross: a printed line has no cells, and
		// which heading a figure sits under is answered by nothing but where it sits
		return {
			outcome: 'grid',
			rows: document.lines.map((line) => {
				return line.map((piece) => {
					return piece.text;
				});
			}),
			positions: document.lines.map((line) => {
				return line.map((piece) => {
					return piece.x;
				});
			})
		};
	}

	const sheet = readXlsxGrid(bytes, source.sheet);

	if(sheet.outcome === 'not-a-workbook') {
		return { outcome: 'refused', refusal: { reason: 'not-a-workbook' } };
	}

	if(sheet.outcome === 'sheet-missing') {
		return {
			outcome: 'refused',
			refusal: { reason: 'sheet-missing', sheet: source.sheet.by === 'name' ? source.sheet.name : String(source.sheet.index + 1) }
		};
	}

	return { outcome: 'grid', rows: sheet.rows };
};

export const registerImportIpcHandlers = ({
	ipcMain,
	dialog,
	getWindow,
	initialDirectory,
	readFile = readFileSync,
	fileSize = (filePath) => {
		return statSync(filePath).size;
	}
}: RegisterImportIpcHandlersOptions): void => {
	/**
	 * The folder the last export was taken from, which is where the next chooser opens.
	 *
	 * **It lives as long as the run and no longer.** A statement is imported a few at a time, from one folder, so opening the
	 * chooser back where the last one came from saves the walk there on every file after the first — and starting a fresh run
	 * back at the downloads folder is right, that being where the export that prompted the run has just landed. Remembering it
	 * any longer would be a stored setting, and the preferences of [§10](../../../docs/functional/specs/10-settings.md) are a
	 * closed list that has no place for one.
	 *
	 * **One folder per import and not one between them.** A payslip and a bank statement are downloaded from different places,
	 * so an import that opened where the other one last went would be sending the user somewhere they have never kept this
	 * kind of file.
	 */
	const lastDirectory = new Map<ImportScope, string>();

	/**
	 * Opens the chooser and says what was chosen.
	 *
	 * **Where it opens is remembered from the file that was chosen and not from the one that was read**: a file refused
	 * afterwards was still found in the folder the user went to, and sending them back to the downloads folder to try again
	 * would be the wrong help.
	 * @param request What the chooser offers and what it is called.
	 * @param multiple Whether it takes more than one document at a time.
	 * @returns The paths, which is empty where the chooser was dismissed.
	 */
	const choose = async(request: ReadImportFileRequest, multiple: boolean): Promise<readonly string[]> => {
		const window = getWindow();
		const properties = multiple ? [ 'openFile' as const, 'multiSelections' as const ] : [ 'openFile' as const ];
		const options = {
			title: request.dialogTitle,
			defaultPath: lastDirectory.get(request.scope) ?? initialDirectory(),
			properties,
			filters: [ { name: request.fileTypeName, extensions: request.extensions } ]
		};
		const chosen = await (window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options));

		if(chosen.canceled || chosen.filePaths.length === 0) {
			return [];
		}

		lastDirectory.set(request.scope, path.dirname(chosen.filePaths[0]));

		return chosen.filePaths;
	};

	/**
	 * Everything one chosen file goes through: how large it is, the bytes, and the grid the template's source turns them into.
	 * @param filePath The file.
	 * @param source What the template says the bytes are.
	 * @returns The grid, or why there is none. Never *cancelled*: a file that was chosen was chosen.
	 */
	const readOne = async(filePath: string, source: ImportSource): Promise<ReadFileOutcome> => {
		let bytes: Buffer;

		try {
			if(fileSize(filePath) > IMPORT_FILE_CONFIG.maximumFileSizeBytes) {
				appLogger.warn('Refused a bank export that is larger than an export can be', { type: 'import.refused', path: filePath, reason: 'unreadable' });

				return { outcome: 'refused', refusal: { reason: 'unreadable' } };
			}

			bytes = readFile(filePath);
		}
		catch(error) {
			appLogger.warn('Could not read a bank export', { type: 'import.refused', path: filePath, reason: 'unreadable', error: String(error) });

			return { outcome: 'refused', refusal: { reason: 'unreadable' } };
		}

		const grid = await readGrid(bytes, source);

		if(grid.outcome !== 'grid') {
			appLogger.warn('Could not read a bank export', {
				type: 'import.refused',
				path: filePath,
				reason: grid.outcome === 'refused' ? grid.refusal.reason : 'unreadable'
			});

			return grid;
		}

		if(grid.rows.length === 0) {
			appLogger.warn('Read a bank export that holds no rows', { type: 'import.refused', path: filePath, reason: 'empty' });

			return { outcome: 'refused', refusal: { reason: 'empty' } };
		}

		appLogger.info('Read a bank export', { type: 'import.read', path: filePath, kind: source.kind, rows: grid.rows.length });

		return { outcome: 'read', fileName: path.basename(filePath), rows: grid.rows, positions: grid.positions };
	};

	// A document's outcome carries the document's own name, the refusals included: a selection is accounted for one row at a time
	const named = (filePath: string, outcome: ReadFileOutcome): ImportFileOutcome => {
		return outcome.outcome === 'read' ?
			outcome :
			{ fileName: path.basename(filePath), outcome: 'refused', refusal: outcome.refusal };
	};

	ipcMain.handle(SPICCIOLI_IMPORT_IPC_CHANNELS.readFile, async(_event, request: ReadImportFileRequest): Promise<ReadImportFileResult> => {
		const chosen = await choose(request, false);

		return chosen.length === 0 ? { outcome: 'cancelled' } : await readOne(chosen[0], request.source);
	});

	/**
	 * The same thing for a chooser that takes several documents, which is how a selection of payslips is read.
	 *
	 * **The files are read one after another and each one answers for itself.** A document nothing can be read out of comes
	 * back refused beside the ones that could be, because it is one marked row in the recap and never the end of the selection
	 * ([§8.1](../../../docs/functional/specs/08-salaries.md#81-payslips)).
	 */
	ipcMain.handle(SPICCIOLI_IMPORT_IPC_CHANNELS.readFiles, async(_event, request: ReadImportFileRequest): Promise<ReadImportFilesResult> => {
		const chosen = await choose(request, true);

		if(chosen.length === 0) {
			return { outcome: 'cancelled' };
		}

		// The one refusal the whole selection takes, and the one nothing is read for: a folder chosen whole rather than a batch
		if(chosen.length > IMPORT_FILE_CONFIG.maximumFiles) {
			appLogger.warn('Refused a selection larger than an import reads at a time', {
				type: 'import.refused',
				files: chosen.length,
				reason: 'too-many'
			});

			return { outcome: 'too-many', count: chosen.length, limit: IMPORT_FILE_CONFIG.maximumFiles };
		}

		const files: ImportFileOutcome[] = [];

		for(const filePath of chosen) {
			files.push(named(filePath, await readOne(filePath, request.source)));
		}

		return { outcome: 'read', files };
	});
};
