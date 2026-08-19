import type { SpiccioliAppMenuApi, SpiccioliMenu, SpiccioliMenuCommandRequest } from 'src/types/AppMenuTypes';

/**
 * The renderer side of the menu bar Spiccioli draws itself.
 *
 * This is the only module that touches "window.spiccioliAppMenu". Nothing here is a failure worth reporting: a menu that could not
 * be read is a window without one, which is exactly what every platform that keeps its native menu bar gets, and a command that
 * could not be sent is a click that did nothing.
 */

// The bridge is only there behind the preload script: the renderer is typed as if it always were, so this is where that is checked
const getAppMenuApi = (): SpiccioliAppMenuApi | undefined => {
	// Typed as always there, because the application always runs behind the preload script; the annotation is what lets the one
	// runtime that has no bridge — a test rendering the row on its own — be answered with no menu instead of a failure
	const appMenuApi: SpiccioliAppMenuApi | undefined = window.spiccioliAppMenu;

	return appMenuApi;
};

/**
 * Asks the main process what the drawn menu bar holds.
 * @returns The submenus to draw, and none at all when this platform and this run keep a native menu bar.
 */
export const loadDrawnMenuBar = async(): Promise<SpiccioliMenu[]> => {
	const appMenuApi = getAppMenuApi();

	if(!appMenuApi) {
		return [];
	}

	try {
		return await appMenuApi.getMenuBar();
	}
	catch {
		return [];
	}
};

/**
 * Follows what the drawn menu bar says, which changes whenever the recent list does.
 * @param listener Handed the submenus every time the main process rebuilds them.
 * @returns The function that cancels the subscription.
 */
export const subscribeToDrawnMenuBar = (listener: (menus: SpiccioliMenu[]) => void): () => void => {
	const appMenuApi = getAppMenuApi();

	if(!appMenuApi) {
		return () => {
			return undefined;
		};
	}

	return appMenuApi.onMenuBarChanged(listener);
};

/**
 * Runs what a menu entry stands for, which the main process owns because it acts on the window and on the open file.
 * @param request The command of the entry the user picked, and the file it names where it names one.
 */
export const runMenuCommand = (request: SpiccioliMenuCommandRequest): void => {
	const appMenuApi = getAppMenuApi();

	if(!appMenuApi) {
		return;
	}

	void appMenuApi.runMenuCommand(request).catch(() => {
		return undefined;
	});
};
