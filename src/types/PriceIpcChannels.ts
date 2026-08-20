/**
 * The channel names both processes import for the one thing in the application that touches the network.
 *
 * The first three are requests the renderer makes and the main process answers. **The fourth is the one thing pushed the other
 * way**: how far a running pass has got, which the screen shows while it waits.
 */
export const SPICCIOLI_PRICES_IPC_CHANNELS = {
	updatePrices: 'spiccioli:prices:update-prices',
	cancelPricePass: 'spiccioli:prices:cancel-pass',
	reportPricesWritten: 'spiccioli:prices:report-prices-written',
	passProgress: 'spiccioli:prices:pass-progress'
} as const;
