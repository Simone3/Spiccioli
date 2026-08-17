/// <reference types="vite/client" />

import type { SpiccioliAppInfoApi } from 'src/types/AppInfoTypes';
import type { SpiccioliDiagnosticsApi, SpiccioliLedgerApi } from 'src/types/LedgerIpcTypes';

declare global {
	interface Window {
		spiccioliAppInfo: SpiccioliAppInfoApi;
		spiccioliLedger: SpiccioliLedgerApi;
		spiccioliDiagnostics: SpiccioliDiagnosticsApi;
	}
}

export {};
