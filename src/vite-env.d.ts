/// <reference types="vite/client" />

import type { SpiccioliAppInfoApi } from 'src/types/AppInfoTypes';

declare global {
	interface Window {
		spiccioliAppInfo: SpiccioliAppInfoApi;
	}
}

export {};
