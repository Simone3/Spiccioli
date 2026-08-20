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
 * anything**: a confirmed pass writes Price records through the document the renderer already holds, and the third channel is
 * how the log gets to hear how the pass ended.
 *
 * **The second channel abandons the pass in flight**, which is what cancelling the modal does. It is a flag and not a kill: the
 * request already sent is finished and dropped, and nothing behind it is asked for.
 *
 * **The fourth channel is the only thing pushed the other way**: how far a running pass has got and what the listing just
 * answered came back with, sent to the window that asked and to no other. **A window gone while the pass ran is simply not
 * told** — the pass is finishing into a page that is no longer there, and its result will be dropped on the same grounds.
 */

type PricesIpcMain = Pick<IpcMain, 'handle'>;

export interface RegisterPricesIpcHandlersOptions {
	ipcMain: PricesIpcMain;
	provider: PriceProvider;
}

export const registerPricesIpcHandlers = ({ ipcMain, provider }: RegisterPricesIpcHandlersOptions): void => {
	// Raised while a pass is meant to stop and lowered by the next one to start. One window and one modal mean one pass at a
	// time, so a single flag is the whole of what tracking a running pass takes.
	let cancelRequested = false;

	ipcMain.handle(SPICCIOLI_PRICES_IPC_CHANNELS.updatePrices, (event: IpcMainInvokeEvent, listings: PriceListingRequest[]) => {
		cancelRequested = false;

		return runPricePass({
			provider,
			listings,
			onProgress: (progress) => {
				if(!event.sender.isDestroyed()) {
					event.sender.send(SPICCIOLI_PRICES_IPC_CHANNELS.passProgress, progress);
				}
			},
			isCancelled: () => {
				return cancelRequested || event.sender.isDestroyed();
			}
		});
	});

	ipcMain.handle(SPICCIOLI_PRICES_IPC_CHANNELS.cancelPricePass, () => {
		cancelRequested = true;
	});

	ipcMain.handle(SPICCIOLI_PRICES_IPC_CHANNELS.reportPricesWritten, (_event, report: PricesWrittenReport) => {
		logPricesWritten(report);
	});
};
