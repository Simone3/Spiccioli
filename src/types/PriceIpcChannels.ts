/**
 * The channel names both processes import for the one thing in the application that touches the network.
 * Both are requests the renderer makes and the main process answers; nothing is pushed the other way.
 */
export const SPICCIOLI_PRICES_IPC_CHANNELS = {
	updatePrices: 'spiccioli:prices:update-prices',
	reportPricesWritten: 'spiccioli:prices:report-prices-written'
} as const;
