import { contextBridge, ipcRenderer } from 'electron';
import { SPICCIOLI_APP_INFO_IPC_CHANNELS } from 'src/types/AppInfoIpcChannels';
import type { SpiccioliAppInfoApi } from 'src/types/AppInfoTypes';

const spiccioliAppInfo: SpiccioliAppInfoApi = {
	getAppInfo: () => {
		return ipcRenderer.invoke(SPICCIOLI_APP_INFO_IPC_CHANNELS.getAppInfo);
	}
};

contextBridge.exposeInMainWorld('spiccioliAppInfo', spiccioliAppInfo);
