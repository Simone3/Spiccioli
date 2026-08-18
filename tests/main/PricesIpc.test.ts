import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { registerPricesIpcHandlers } from 'src/main/ipc/PricesIpc';
import { SPICCIOLI_PRICES_IPC_CHANNELS } from 'src/types/PriceIpcChannels';
import type { PriceProvider } from 'src/main/prices/PriceProvider';
import type { PricePassResult } from 'src/types/PriceIpcTypes';

type RegisteredIpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

// The window that asked, which is the only one a pass reports its progress to
const createMockEvent = (sent: { channel: string; payload: unknown }[] = [], isDestroyed = false): IpcMainInvokeEvent => {
	return {
		sender: {
			isDestroyed: () => {
				return isDestroyed;
			},
			send: (channel: string, payload: unknown) => {
				sent.push({ channel, payload });
			}
		}
	} as unknown as IpcMainInvokeEvent;
};

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
	fetchQuotes: () => {
		return Promise.resolve({ outcome: 'no-quote' });
	}
};

describe('PricesIpc', () => {
	test('registers the channels a pass is made of and no others', () => {
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
			createMockEvent(),
			[ { securityId: 'swda', ticker: 'SWDA', exchange: 'milan', from: null } ]
		) as PricePassResult;

		expect(result.outcomes).toEqual([ { outcome: 'no-quote', securityId: 'swda' } ]);
	});

	test('reports how far the pass has got to the window that asked', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const sent: { channel: string; payload: unknown }[] = [];

		registerPricesIpcHandlers({ ipcMain, provider });

		await handlers.get(SPICCIOLI_PRICES_IPC_CHANNELS.updatePrices)?.(
			createMockEvent(sent),
			[ { securityId: 'swda', ticker: 'SWDA', exchange: 'milan', from: null } ]
		);

		expect(sent).toEqual([ {
			channel: SPICCIOLI_PRICES_IPC_CHANNELS.passProgress,
			payload: { done: 1, total: 1, ticker: 'SWDA' }
		} ]);
	});

	test('says nothing to a window that is gone, the pass finishing into a page that is no longer there', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const sent: { channel: string; payload: unknown }[] = [];

		registerPricesIpcHandlers({ ipcMain, provider });

		await handlers.get(SPICCIOLI_PRICES_IPC_CHANNELS.updatePrices)?.(
			createMockEvent(sent, true),
			[ { securityId: 'swda', ticker: 'SWDA', exchange: 'milan', from: null } ]
		);

		expect(sent).toEqual([]);
	});

	test('takes what the confirmation wrote, a cancelled pass included', () => {
		const { handlers, ipcMain } = createMockIpcMain();

		registerPricesIpcHandlers({ ipcMain, provider });

		const report = handlers.get(SPICCIOLI_PRICES_IPC_CHANNELS.reportPricesWritten);

		expect(report?.(createMockEvent(), { writtenCount: 0, firstDate: null, lastDate: null })).toBeUndefined();
	});
});
