import { makeTranslator } from '../testUtils';
import { registerLedgerIpcHandlers } from 'src/main/ipc/LedgerIpc';
import { SPICCIOLI_LEDGER_IPC_CHANNELS } from 'src/types/LedgerIpcChannels';
import type { LedgerSession } from 'src/main/storage/LedgerSession';
import type { SpiccioliConfigStore } from 'src/main/config/SpiccioliConfigStore';
import type { ChooseLedgerFileResult } from 'src/types/LedgerIpcTypes';

/**
 * The renderer's way to the file, from the main process's side.
 *
 * What is worth testing here is the part that is not a pass-through: the save dialog checks for an existing file under the name
 * that was typed, and the ledger's extension goes on afterwards — so there is one path where nobody has asked before a file is
 * replaced, and this is where it is asked.
 */

interface IpcHarness {
	invoke: (channel: string, payload?: unknown) => Promise<unknown>;
	savedPaths: { value: string | undefined };
	existingFiles: Set<string>;
	messageBoxes: { message: string }[];
	messageBoxAnswer: { value: number };
	closesPaused: { value: number };
}

const makeHarness = (): IpcHarness => {
	const handlers = new Map<string, (event: unknown, payload?: unknown) => unknown>();
	const savedPaths = { value: undefined as string | undefined };
	const existingFiles = new Set<string>();
	const messageBoxes: { message: string }[] = [];
	const messageBoxAnswer = { value: 0 };
	const closesPaused = { value: 0 };

	registerLedgerIpcHandlers({
		ipcMain: {
			handle: (channel: string, handler: (event: unknown, payload?: unknown) => unknown) => {
				handlers.set(channel, handler);
			}
		} as never,
		dialog: {
			showOpenDialog: () => {
				return Promise.resolve({ canceled: true, filePaths: [] });
			},
			showSaveDialog: () => {
				return Promise.resolve({ canceled: savedPaths.value === undefined, filePath: savedPaths.value });
			},
			showMessageBox: (options: unknown) => {
				messageBoxes.push({ message: (options as { message: string }).message });

				return Promise.resolve({ response: messageBoxAnswer.value });
			}
		} as never,
		session: {} as LedgerSession,
		configStore: {} as SpiccioliConfigStore,
		translator: makeTranslator(),
		getWindow: () => {
			return undefined;
		},
		onOpenFileChanged: () => {
			return undefined;
		},
		onCloseCancelled: () => {
			return undefined;
		},
		onClosePaused: () => {
			closesPaused.value += 1;
		},
		onPreferencesChanged: () => {
			return undefined;
		},
		fileExists: (filePath) => {
			return existingFiles.has(filePath);
		}
	});

	return {
		invoke: async(channel, payload) => {
			return handlers.get(channel)?.({}, payload);
		},
		savedPaths,
		existingFiles,
		messageBoxes,
		messageBoxAnswer,
		closesPaused
	};
};

const chooseFileToCreate = async(harness: IpcHarness): Promise<ChooseLedgerFileResult> => {
	return await harness.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.chooseFileToCreate) as ChooseLedgerFileResult;
};

describe('choosing where a new ledger goes', () => {
	test('puts the extension back on where the dialog did not', async() => {
		const harness = makeHarness();
		harness.savedPaths.value = '/ledgers/finances';

		expect(await chooseFileToCreate(harness)).toEqual({ cancelled: false, filePath: '/ledgers/finances.spiccioli' });
		expect(harness.messageBoxes).toEqual([]);
	});

	/**
	 * The one path where nothing has asked. The dialog checked "/ledgers/finances", which is not there; what is about to be
	 * written is "/ledgers/finances.spiccioli", which is a ledger the user still has and which nothing would have copied first.
	 */
	test('asks before a name the extension changed lands on a file that is already there', async() => {
		const harness = makeHarness();
		harness.savedPaths.value = '/ledgers/finances';
		harness.existingFiles.add('/ledgers/finances.spiccioli');

		expect(await chooseFileToCreate(harness)).toEqual({ cancelled: false, filePath: '/ledgers/finances.spiccioli' });
		expect(harness.messageBoxes).toHaveLength(1);
		expect(harness.messageBoxes[0].message).toContain('finances.spiccioli');
	});

	test('writes nothing where that question is answered with cancel', async() => {
		const harness = makeHarness();
		harness.savedPaths.value = '/ledgers/finances';
		harness.existingFiles.add('/ledgers/finances.spiccioli');
		harness.messageBoxAnswer.value = 1;

		expect(await chooseFileToCreate(harness)).toEqual({ cancelled: true });
	});

	// The dialog has already asked in its own words, and one file asked about twice is worse than not asking at all
	test('does not ask again where the dialog checked the name being written', async() => {
		const harness = makeHarness();
		harness.savedPaths.value = '/ledgers/finances.spiccioli';
		harness.existingFiles.add('/ledgers/finances.spiccioli');

		expect(await chooseFileToCreate(harness)).toEqual({ cancelled: false, filePath: '/ledgers/finances.spiccioli' });
		expect(harness.messageBoxes).toEqual([]);
	});

	test('cancelling the dialog chooses nothing', async() => {
		const harness = makeHarness();

		expect(await chooseFileToCreate(harness)).toEqual({ cancelled: true });
	});
});

describe('the answers to a close', () => {
	test('a close waiting on the user holds the wait off rather than calling it off', async() => {
		const harness = makeHarness();

		await harness.invoke(SPICCIOLI_LEDGER_IPC_CHANNELS.pauseClose);

		expect(harness.closesPaused.value).toBe(1);
	});
});
