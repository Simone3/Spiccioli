import type { IpcRenderer, IpcRendererEvent } from 'electron';

type BridgeIpcRenderer = Pick<IpcRenderer, 'on' | 'removeListener'>;

/**
 * Subscribes to a main-process event on behalf of the renderer.
 * The context bridge cannot pass the Electron event object across, so the listener only receives the payload.
 * @param ipcRenderer Electron renderer IPC handle.
 * @param channel Channel the main process sends on.
 * @param listener Callback invoked with the payload.
 * @returns The callback that unsubscribes.
 */
export const subscribeToChannel = <TPayload = void>(
	ipcRenderer: BridgeIpcRenderer,
	channel: string,
	listener: (payload: TPayload) => void
): () => void => {
	const channelListener = (_event: IpcRendererEvent, payload: TPayload): void => {
		listener(payload);
	};

	ipcRenderer.on(channel, channelListener);

	return () => {
		ipcRenderer.removeListener(channel, channelListener);
	};
};
