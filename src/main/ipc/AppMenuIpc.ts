import type { IpcMain } from 'electron';
import { runSpiccioliMenuCommand, type SpiccioliMenuCommandInput, type SpiccioliMenuCommandTarget } from 'src/main/menu/MenuCommands';
import { SPICCIOLI_APP_MENU_IPC_CHANNELS } from 'src/types/AppMenuIpcChannels';
import type { SpiccioliMenu } from 'src/types/AppMenuTypes';

export { SPICCIOLI_APP_MENU_IPC_CHANNELS } from 'src/types/AppMenuIpcChannels';

type AppMenuIpcMain = Pick<IpcMain, 'handle'>;

export interface RegisterAppMenuIpcHandlersOptions {
	ipcMain: AppMenuIpcMain;

	// What the renderer draws, or nothing at all on a platform that keeps its native menu bar. The main process decides which it is,
	// because it is the side that knows the platform and whether the native menu was hidden. It is read again on every request
	// rather than captured, because Open Recent changes every time a file is opened.
	getMenuBar: () => SpiccioliMenu[];

	commandTarget: SpiccioliMenuCommandTarget;
}

// The two halves of the menu bar Spiccioli draws itself: what it says, which the main process owns because it owns the menu, and
// what happens when an entry is picked, which stays in the main process because a menu entry acts on the window and on the file.
export const registerAppMenuIpcHandlers = ({ ipcMain, getMenuBar, commandTarget }: RegisterAppMenuIpcHandlersOptions): void => {
	ipcMain.handle(SPICCIOLI_APP_MENU_IPC_CHANNELS.getMenuBar, (): SpiccioliMenu[] => {
		return getMenuBar();
	});

	ipcMain.handle(SPICCIOLI_APP_MENU_IPC_CHANNELS.runMenuCommand, (_event, request: unknown): void => {
		// Nothing but a known command name is acted on, and an unknown one is not an error worth reporting: it can only come from a
		// renderer asking for something this menu does not offer
		if(typeof request !== 'object' || request === null) {
			return;
		}

		const { command, filePath } = request as Partial<SpiccioliMenuCommandInput>;

		if(typeof command !== 'string') {
			return;
		}

		runSpiccioliMenuCommand({ command, filePath: typeof filePath === 'string' ? filePath : undefined }, commandTarget);
	});
};
