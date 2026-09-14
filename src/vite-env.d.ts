/// <reference types="vite/client" />

import type { SpiccioliAppInfoApi } from 'src/types/AppInfoTypes';
import type { SpiccioliAppMenuApi } from 'src/types/AppMenuTypes';
import type { SpiccioliImportApi } from 'src/types/ImportIpcTypes';
import type { SpiccioliDiagnosticsApi, SpiccioliLedgerApi } from 'src/types/LedgerIpcTypes';
import type { SpiccioliPricesApi } from 'src/types/PriceIpcTypes';

declare global {
	interface Window {
		spiccioliAppInfo: SpiccioliAppInfoApi;
		spiccioliAppMenu: SpiccioliAppMenuApi;
		spiccioliLedger: SpiccioliLedgerApi;
		spiccioliPrices: SpiccioliPricesApi;
		spiccioliImport: SpiccioliImportApi;
		spiccioliDiagnostics: SpiccioliDiagnosticsApi;
	}
}

export {};
