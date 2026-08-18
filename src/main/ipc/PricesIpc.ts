import type { IpcMain } from 'electron';
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
 */

type PricesIpcMain = Pick<IpcMain, 'handle'>;

export interface RegisterPricesIpcHandlersOptions {
	ipcMain: PricesIpcMain;
	provider: PriceProvider;
}

export const registerPricesIpcHandlers = ({ ipcMain, provider }: RegisterPricesIpcHandlersOptions): void => {
	ipcMain.handle(SPICCIOLI_PRICES_IPC_CHANNELS.updatePrices, (_event, listings: PriceListingRequest[]) => {
		return runPricePass({ provider, listings });
	});

	ipcMain.handle(SPICCIOLI_PRICES_IPC_CHANNELS.reportPricesWritten, (_event, report: PricesWrittenReport) => {
		logPricesWritten(report);
	});
};
