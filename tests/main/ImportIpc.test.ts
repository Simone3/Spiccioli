import type { Dialog, IpcMain, IpcMainInvokeEvent, OpenDialogReturnValue } from 'electron';
import { buildSampleImport } from './SampleImportFixtures';
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

const invokeRead = async(options: HandlerOptions, request: ReadImportFileRequest = XLSX_REQUEST): Promise<ReadImportFileResult> => {
	const handlers = new Map<string, RegisteredIpcHandler>();
	const ipcMain: Pick<IpcMain, 'handle'> = {
		handle: vi.fn((channel: string, handler: RegisteredIpcHandler) => {
			handlers.set(channel, handler);
		})
	};
	const dialog: Pick<Dialog, 'showOpenDialog'> = {
		showOpenDialog: vi.fn(() => {
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

	return await handler({} as IpcMainInvokeEvent, request) as ReadImportFileResult;
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

	test('reads a delimited file under the delimiter and the encoding the template names', async() => {
		const result = await invokeRead(
			{ bytes: Buffer.from([ 0x43, 0x69, 0x74, 0x74, 0xe0, 0x3b, 0x31, 0x32 ]) },
			{ ...XLSX_REQUEST, source: { kind: 'csv', delimiter: ';', encoding: 'windows-1252' }, extensions: [ 'csv' ] }
		);

		expect(result.outcome === 'read' && result.rows).toEqual([ [ 'Città', '12' ] ]);
	});
});
