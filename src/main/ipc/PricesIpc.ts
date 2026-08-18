import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { logPricesWritten, runPricePass } from 'src/main/prices/PricePass';
import { SPICCIOLI_PRICES_IPC_CHANNELS } from 'src/types/PriceIpcChannels';
import type { PriceProvider } from 'src/main/prices/PriceProvider';
import type { PriceListingRequest, PricesWrittenReport } from 'src/types/PriceIpcTypes';

/**
 * The renderer's way to the network, and the only one there is.
 *
 * The renderer holds the ledger, so it is the side that knows which securities exist; the main process reaches the network, so
 * it is the side that asks. What crosses is a listing out and a quote-or-a-reason back, and **nothing on this channel writes
 * anything**: a confirmed pass writes Price records through the document the renderer already holds, and the second channel is
 * how the log gets to hear how the pass ended.
 *
 * **The third channel is the only thing pushed the other way**: how far a running pass has got, sent back to the window that
 * asked for it and to no other. **A window gone while the pass ran is simply not told** — the pass is finishing into a page that
 * is no longer there, and its result will be dropped on the same grounds.
 */

type PricesIpcMain = Pick<IpcMain, 'handle'>;

export interface RegisterPricesIpcHandlersOptions {
	ipcMain: PricesIpcMain;
	provider: PriceProvider;
}

export const registerPricesIpcHandlers = ({ ipcMain, provider }: RegisterPricesIpcHandlersOptions): void => {
	ipcMain.handle(SPICCIOLI_PRICES_IPC_CHANNELS.updatePrices, (event: IpcMainInvokeEvent, listings: PriceListingRequest[]) => {
		return runPricePass({
			provider,
			listings,
			onProgress: (progress) => {
				if(!event.sender.isDestroyed()) {
					event.sender.send(SPICCIOLI_PRICES_IPC_CHANNELS.passProgress, progress);
				}
			}
		});
	});

	ipcMain.handle(SPICCIOLI_PRICES_IPC_CHANNELS.reportPricesWritten, (_event, report: PricesWrittenReport) => {
		logPricesWritten(report);
	});
};
