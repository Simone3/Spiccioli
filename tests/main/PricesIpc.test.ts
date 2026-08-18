import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { registerPricesIpcHandlers } from 'src/main/ipc/PricesIpc';
import { SPICCIOLI_PRICES_IPC_CHANNELS } from 'src/types/PriceIpcChannels';
import type { PriceProvider } from 'src/main/prices/PriceProvider';
import type { PricePassResult } from 'src/types/PriceIpcTypes';

type RegisteredIpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const createMockIpcMain = (): { handlers: Map<string, RegisteredIpcHandler>; ipcMain: Pick<IpcMain, 'handle'> } => {
	const handlers = new Map<string, RegisteredIpcHandler>();

	return {
		handlers,
		ipcMain: {
			handle: vi.fn((channel: string, handler: RegisteredIpcHandler) => {
				handlers.set(channel, handler);
			})
		}
	};
};

const provider: PriceProvider = {
	fetchQuote: () => {
		return Promise.resolve({ outcome: 'no-quote' });
	}
};

describe('PricesIpc', () => {
	test('registers the two channels a pass is made of and no others', () => {
		const { handlers, ipcMain } = createMockIpcMain();

		registerPricesIpcHandlers({ ipcMain, provider });

		expect([ ...handlers.keys() ].sort()).toEqual([
			SPICCIOLI_PRICES_IPC_CHANNELS.reportPricesWritten,
			SPICCIOLI_PRICES_IPC_CHANNELS.updatePrices
		].sort());
	});

	test('runs the pass over what the renderer asked about', async() => {
		const { handlers, ipcMain } = createMockIpcMain();

		registerPricesIpcHandlers({ ipcMain, provider });

		const result = await handlers.get(SPICCIOLI_PRICES_IPC_CHANNELS.updatePrices)?.(
			{} as IpcMainInvokeEvent,
			[ { securityId: 'swda', ticker: 'SWDA', exchange: 'milan' } ]
		) as PricePassResult;

		expect(result.outcomes).toEqual([ { outcome: 'no-quote', securityId: 'swda' } ]);
	});

	test('takes what the confirmation wrote, a cancelled pass included', () => {
		const { handlers, ipcMain } = createMockIpcMain();

		registerPricesIpcHandlers({ ipcMain, provider });

		const report = handlers.get(SPICCIOLI_PRICES_IPC_CHANNELS.reportPricesWritten);

		expect(report?.({} as IpcMainInvokeEvent, { writtenCount: 0, dates: [] })).toBeUndefined();
	});
});
