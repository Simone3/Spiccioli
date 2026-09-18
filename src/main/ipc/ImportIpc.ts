import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { BrowserWindow, Dialog, IpcMain } from 'electron';
import { IMPORT_FILE_CONFIG } from 'src/config/AppConfig';
import { appLogger } from 'src/framework/main/logging/AppLogger';
import { decodeDelimitedText, parseDelimitedRows } from 'src/main/import/DelimitedGrid';
import { readPdfLines } from 'src/main/import/PdfText';
import { readXlsxGrid } from 'src/main/import/XlsxGrid';
import { SPICCIOLI_IMPORT_IPC_CHANNELS } from 'src/types/ImportIpcChannels';
import type { ImportScope, ImportSource, ReadImportFileRequest, ReadImportFileResult } from 'src/types/ImportIpcTypes';

/**
 * The renderer's way to a file an import reads, and the only one there is.
 *
 * **One round trip does the whole of it**: the chooser opens, the bytes are read, and a grid of cell text comes back. The path
 * never crosses, because nothing in the window has anything to do with one — the file is read here and is not opened again.
 *
 * **Nothing here knows what a column is for.** Which of them carries a date and which carries an amount is the template's
 * business and the template is the renderer's, so what this answers with is the text the cells hold and no reading of it.
 *
 * **What it writes to the log is a path, a count and a reason, and never a cell** ([§8.4](../../../docs/technical/08-decisions.md#84-what-d14-logs)):
 * an export is somebody's spending, line by line, and the log is the one place in the application it must not reach.
 */

type ImportIpcMain = Pick<IpcMain, 'handle'>;

type ImportDialog = Pick<Dialog, 'showOpenDialog'>;

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
 * @returns The grid, or why there is none.
 */
const readGrid = async(bytes: Buffer, source: ImportSource): Promise<ReadImportFileResult | { outcome: 'grid'; rows: string[][] }> => {
	if(source.kind === 'csv') {
		return { outcome: 'grid', rows: parseDelimitedRows(decodeDelimitedText(bytes, source.encoding), source.delimiter) };
	}

	if(source.kind === 'pdf') {
		const document = await readPdfLines(bytes);

		return document.outcome === 'lines' ? { outcome: 'grid', rows: document.lines } : { outcome: 'refused', refusal: { reason: 'not-a-pdf' } };
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

	ipcMain.handle(SPICCIOLI_IMPORT_IPC_CHANNELS.readFile, async(_event, request: ReadImportFileRequest): Promise<ReadImportFileResult> => {
		const window = getWindow();
		const options = {
			title: request.dialogTitle,
			defaultPath: lastDirectory.get(request.scope) ?? initialDirectory(),
			properties: [ 'openFile' as const ],
			filters: [ { name: request.fileTypeName, extensions: request.extensions } ]
		};
		const chosen = await (window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options));

		if(chosen.canceled || chosen.filePaths.length === 0) {
			return { outcome: 'cancelled' };
		}

		const filePath = chosen.filePaths[0];

		// Taken from the file that was chosen rather than from the one that was read: a file refused afterwards was still found
		// in the folder the user went to, and sending them back to the downloads folder to try again would be the wrong help
		lastDirectory.set(request.scope, path.dirname(filePath));

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

		const grid = await readGrid(bytes, request.source);

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

		appLogger.info('Read a bank export', { type: 'import.read', path: filePath, kind: request.source.kind, rows: grid.rows.length });

		return { outcome: 'read', fileName: path.basename(filePath), rows: grid.rows };
	});
};
