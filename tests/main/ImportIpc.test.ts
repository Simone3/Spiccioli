import type { Dialog, IpcMain, IpcMainInvokeEvent, OpenDialogOptions, OpenDialogReturnValue } from 'electron';
import { buildSampleImport } from './SampleImportFixtures';
import { buildSamplePayslip } from './SamplePayslipFixtures';
import { registerImportIpcHandlers } from 'src/main/ipc/ImportIpc';
import { SPICCIOLI_IMPORT_IPC_CHANNELS } from 'src/types/ImportIpcChannels';
import type { ReadImportFileRequest, ReadImportFileResult, ReadImportFilesResult } from 'src/types/ImportIpcTypes';

/**
 * The one channel a bank export crosses. What it answers with is a grid or a reason, and **never a path**: the file is read
 * here and the window is told what was in it, not where it was.
 */

type RegisteredIpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const XLSX_REQUEST: ReadImportFileRequest = {
	source: { kind: 'xlsx', sheet: { by: 'index', index: 0 } },
	scope: 'transactions',
	fileTypeName: 'Excel workbook',
	extensions: [ 'xlsx' ],
	dialogTitle: 'Choose a bank export'
};

interface HandlerOptions {
	chosen?: string[];
	bytes?: Buffer;

	// What each file holds, where a selection of several needs them to differ
	bytesOf?: (filePath: string) => Buffer;
	size?: number;
	throws?: boolean;
}

const PDF_REQUEST: ReadImportFileRequest = {
	source: { kind: 'pdf' },
	scope: 'payslips',
	fileTypeName: 'PDF document',
	extensions: [ 'pdf' ],
	dialogTitle: 'Choose a payslip'
};

const DOWNLOADS = '/Users/someone/Downloads';

/**
 * Registers the handler and hands back a way to call it as many times as a test needs, which is what a folder remembered
 * across imports has to be asked about: one registration is one run of the application.
 * @param options What this test needs the disk and the chooser to do.
 * @returns The way to invoke the channel, and the choosers that were opened.
 */
const registerRun = (options: HandlerOptions): {
	read: (request?: ReadImportFileRequest) => Promise<ReadImportFileResult>;
	readMany: (request?: ReadImportFileRequest) => Promise<ReadImportFilesResult>;
	opened: OpenDialogOptions[];
} => {
	const handlers = new Map<string, RegisteredIpcHandler>();

	// Every chooser the run opened, so that a test can say where each of them opened
	const opened: OpenDialogOptions[] = [];
	const ipcMain: Pick<IpcMain, 'handle'> = {
		handle: vi.fn((channel: string, handler: RegisteredIpcHandler) => {
			handlers.set(channel, handler);
		})
	};
	const dialog: Pick<Dialog, 'showOpenDialog'> = {
		showOpenDialog: vi.fn((dialogOptions: OpenDialogOptions) => {
			opened.push(dialogOptions);

			const filePaths = options.chosen ?? [ '/somewhere/statement.xlsx' ];

			return Promise.resolve({ canceled: filePaths.length === 0, filePaths } as OpenDialogReturnValue);
		})
	};

	registerImportIpcHandlers({
		ipcMain,
		dialog,
		getWindow: () => {
			return undefined;
		},
		initialDirectory: () => {
			return DOWNLOADS;
		},
		readFile: (filePath: string) => {
			if(options.throws) {
				throw new Error('no such file');
			}

			return options.bytesOf?.(filePath) ?? options.bytes ?? buildSampleImport('isybank');
		},
		fileSize: () => {
			return options.size ?? 1000;
		}
	});

	const handler = handlers.get(SPICCIOLI_IMPORT_IPC_CHANNELS.readFile);
	const manyHandler = handlers.get(SPICCIOLI_IMPORT_IPC_CHANNELS.readFiles);

	if(!handler || !manyHandler) {
		throw new Error('The import channels were not registered');
	}

	return {
		opened,
		read: async(request: ReadImportFileRequest = XLSX_REQUEST) => {
			return await handler({} as IpcMainInvokeEvent, request) as ReadImportFileResult;
		},
		readMany: async(request: ReadImportFileRequest = PDF_REQUEST) => {
			return await manyHandler({} as IpcMainInvokeEvent, request) as ReadImportFilesResult;
		}
	};
};

const invokeRead = async(options: HandlerOptions, request: ReadImportFileRequest = XLSX_REQUEST): Promise<ReadImportFileResult> => {
	return await registerRun(options).read(request);
};

describe('reading a bank export over IPC', () => {
	test('answers with the grid and the file name, and with no path at all', async() => {
		const result = await invokeRead({});

		expect(result.outcome).toBe('read');

		if(result.outcome === 'read') {
			expect(result.fileName).toBe('statement.xlsx');
			expect(result.rows[13]).toEqual([ 'Data', 'Operazione', 'Dettagli', 'Conto o carta', 'Contabilizzazione', 'Categoria ', 'Valuta', 'Importo' ]);
			expect(JSON.stringify(result)).not.toContain('/somewhere');
		}
	});

	test('answers a chooser that was dismissed with nothing having happened', async() => {
		expect((await invokeRead({ chosen: [] })).outcome).toBe('cancelled');
	});

	test('refuses a file that is not a workbook', async() => {
		const result = await invokeRead({ bytes: Buffer.from('Date,Description,Amount', 'utf8') });

		expect(result.outcome === 'refused' && result.refusal.reason).toBe('not-a-workbook');
	});

	test('refuses a sheet the workbook does not carry, and says which was wanted', async() => {
		const result = await invokeRead({}, { ...XLSX_REQUEST, source: { kind: 'xlsx', sheet: { by: 'name', name: 'Movimenti' } } });

		expect(result.outcome === 'refused' && result.refusal.reason === 'sheet-missing' && result.refusal.sheet).toBe('Movimenti');
	});

	test('refuses a file far larger than an export is, without reading it', async() => {
		const result = await invokeRead({ size: 500 * 1024 * 1024, throws: true });

		expect(result.outcome === 'refused' && result.refusal.reason).toBe('unreadable');
	});

	test('refuses a file that could not be read off the disk', async() => {
		const result = await invokeRead({ throws: true });

		expect(result.outcome === 'refused' && result.refusal.reason).toBe('unreadable');
	});

	test('refuses a delimited file with nothing in it', async() => {
		const result = await invokeRead(
			{ bytes: Buffer.from('', 'utf8') },
			{ ...XLSX_REQUEST, source: { kind: 'csv', delimiter: ';', encoding: 'utf-8' }, extensions: [ 'csv' ] }
		);

		expect(result.outcome === 'refused' && result.refusal.reason).toBe('empty');
	});

	test('reads a payslip document out as the lines it prints and the points they sit at', async() => {
		const result = await invokeRead(
			{ bytes: buildSamplePayslip('full'), chosen: [ '/somewhere/payslip.pdf' ] },
			{ ...XLSX_REQUEST, scope: 'payslips', source: { kind: 'pdf' }, extensions: [ 'pdf' ] }
		);

		expect(result.outcome).toBe('read');

		if(result.outcome === 'read') {
			expect(result.fileName).toBe('payslip.pdf');

			const line = result.rows.findIndex((row) => {
				return row[0] === 'TOTALE LORDO';
			});

			expect(line).toBeGreaterThan(-1);

			// A printed line has no cells, so what says which heading a figure belongs to is the point it is printed at
			expect(result.positions?.[line]).toHaveLength(result.rows[line].length);
			expect(result.positions?.[line][0]).toBeCloseTo(27);
		}
	});

	test('refuses a file that is not a document', async() => {
		const result = await invokeRead(
			{ bytes: Buffer.from('Date,Description,Amount', 'utf8') },
			{ ...XLSX_REQUEST, scope: 'payslips', source: { kind: 'pdf' }, extensions: [ 'pdf' ] }
		);

		expect(result.outcome === 'refused' && result.refusal.reason).toBe('not-a-pdf');
	});

	test('reads a delimited file under the delimiter and the encoding the template names', async() => {
		const result = await invokeRead(
			{ bytes: Buffer.from([ 0x43, 0x69, 0x74, 0x74, 0xe0, 0x3b, 0x31, 0x32 ]) },
			{ ...XLSX_REQUEST, source: { kind: 'csv', delimiter: ';', encoding: 'windows-1252' }, extensions: [ 'csv' ] }
		);

		expect(result.outcome === 'read' && result.rows).toEqual([ [ 'Città', '12' ] ]);
	});
});

/**
 * A chooser that takes several documents at once, which is how a selection of payslips is read.
 *
 * **Every document answers for itself.** A selection is accounted for one row at a time, so a scan among twelve payslips comes
 * back refused beside the eleven that could be read rather than taking them down with it.
 */
describe('reading a selection of documents over IPC', () => {
	const SELECTION = [ '/somewhere/march.pdf', '/somewhere/letter.pdf', '/somewhere/april.pdf' ];

	// The payslip for the two that are payslips, and something nothing can be opened out of for the one in the middle
	const bytesOf = (filePath: string): Buffer => {
		return filePath.endsWith('letter.pdf') ? Buffer.from('Dear customer', 'utf8') : buildSamplePayslip('full');
	};

	test('opens a chooser that takes more than one document', async() => {
		const run = registerRun({ chosen: SELECTION, bytesOf });

		await run.readMany();

		expect(run.opened[0].properties).toContain('multiSelections');
	});

	test('answers with one outcome per document, each carrying the name of its own file', async() => {
		const result = await registerRun({ chosen: SELECTION, bytesOf }).readMany();

		expect(result.outcome).toBe('read');

		if(result.outcome !== 'read') {
			return;
		}

		expect(result.files.map((file) => {
			return file.fileName;
		})).toEqual([ 'march.pdf', 'letter.pdf', 'april.pdf' ]);

		// The one nothing could be opened out of is refused where it stands, and the two beside it are read
		expect(result.files[0].outcome).toBe('read');
		expect(result.files[1].outcome === 'refused' && result.files[1].refusal.reason).toBe('not-a-pdf');
		expect(result.files[2].outcome === 'read' && result.files[2].rows.length).toBeGreaterThan(0);

		// The path never crosses, whatever happened to the file it points at
		expect(JSON.stringify(result)).not.toContain('/somewhere');
	});

	test('answers a chooser that was dismissed with nothing having happened', async() => {
		expect((await registerRun({ chosen: [] }).readMany()).outcome).toBe('cancelled');
	});

	// The one refusal a whole selection takes. Nothing is read for it, which is what the read that would throw is here to say.
	test('refuses a selection larger than an import reads at a time, without reading any of it', async() => {
		const folder = Array.from({ length: 66 }, (_unused, index) => {
			return `/somewhere/payslip-${index}.pdf`;
		});
		const result = await registerRun({ chosen: folder, throws: true }).readMany();

		expect(result.outcome === 'too-many' && result.count).toBe(66);
		expect(result.outcome === 'too-many' && result.limit).toBe(65);
	});

	test('remembers the folder a selection was taken from, the same way one file does', async() => {
		const run = registerRun({ chosen: [ '/Users/someone/Documents/Payslips/march.pdf' ], bytesOf });

		await run.readMany();
		await run.readMany();

		expect(run.opened[1].defaultPath).toBe('/Users/someone/Documents/Payslips');
	});
});

describe('where the chooser opens', () => {
	test('opens the first chooser of a run in the downloads folder, where an export has just landed', async() => {
		const run = registerRun({});

		await run.read();

		expect(run.opened[0].defaultPath).toBe(DOWNLOADS);
	});

	test('opens every later chooser of that run where the last export was taken from', async() => {
		const run = registerRun({ chosen: [ '/Users/someone/Documents/Banks/statement.xlsx' ] });

		await run.read();
		await run.read();

		expect(run.opened[1].defaultPath).toBe('/Users/someone/Documents/Banks');
	});

	// A payslip and a bank statement are downloaded from different places, so one memory between them would send each import
	// back to where the other one went
	test('remembers a folder per import and never one between them', async() => {
		const run = registerRun({ chosen: [ '/Users/someone/Documents/Banks/statement.xlsx' ] });

		await run.read();
		await run.read({ ...XLSX_REQUEST, scope: 'payslips' });

		expect(run.opened[1].defaultPath).toBe(DOWNLOADS);
	});

	// The folder was where the user went to, whether or not what they found there could be read: sending them back to the
	// downloads folder to try again would be the wrong help
	test('remembers the folder of a file it went on to refuse', async() => {
		const run = registerRun({ chosen: [ '/Users/someone/Documents/statement.xlsx' ], bytes: Buffer.from('not a workbook', 'utf8') });

		expect((await run.read()).outcome).toBe('refused');

		await run.read();

		expect(run.opened[1].defaultPath).toBe('/Users/someone/Documents');
	});

	test('remembers nothing from a chooser that was dismissed', async() => {
		const run = registerRun({ chosen: [] });

		await run.read();
		await run.read();

		expect(run.opened[1].defaultPath).toBe(DOWNLOADS);
	});
});
