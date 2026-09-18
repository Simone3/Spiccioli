import type { Dialog, IpcMain, IpcMainInvokeEvent, OpenDialogOptions, OpenDialogReturnValue } from 'electron';
import { buildSampleImport } from './SampleImportFixtures';
import { buildSamplePayslip } from './SamplePayslipFixtures';
import { registerImportIpcHandlers } from 'src/main/ipc/ImportIpc';
import { SPICCIOLI_IMPORT_IPC_CHANNELS } from 'src/types/ImportIpcChannels';
import type { ReadImportFileRequest, ReadImportFileResult } from 'src/types/ImportIpcTypes';

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
	size?: number;
	throws?: boolean;
}

const DOWNLOADS = '/Users/someone/Downloads';

/**
 * Registers the handler and hands back a way to call it as many times as a test needs, which is what a folder remembered
 * across imports has to be asked about: one registration is one run of the application.
 * @param options What this test needs the disk and the chooser to do.
 * @returns The way to invoke the channel, and the choosers that were opened.
 */
const registerRun = (options: HandlerOptions): {
	read: (request?: ReadImportFileRequest) => Promise<ReadImportFileResult>;
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
		readFile: () => {
			if(options.throws) {
				throw new Error('no such file');
			}

			return options.bytes ?? buildSampleImport('isybank');
		},
		fileSize: () => {
			return options.size ?? 1000;
		}
	});

	const handler = handlers.get(SPICCIOLI_IMPORT_IPC_CHANNELS.readFile);

	if(!handler) {
		throw new Error('The import channel was not registered');
	}

	return {
		opened,
		read: async(request: ReadImportFileRequest = XLSX_REQUEST) => {
			return await handler({} as IpcMainInvokeEvent, request) as ReadImportFileResult;
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
