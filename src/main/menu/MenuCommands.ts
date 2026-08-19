import type { BrowserWindow, WebContents } from 'electron';
import { ZOOM_CONFIG } from 'src/config/AppConfig';
import { SPICCIOLI_MENU_COMMANDS, type SpiccioliMenuCommand } from 'src/types/AppMenuTypes';
import type { LedgerMenuCommand } from 'src/types/LedgerIpcTypes';

/**
 * What the entries of the menu bar Spiccioli draws itself actually do.
 *
 * The native menu answers its own entries, because each of them is either an Electron role or an item with a click of its own. A
 * drawn entry has neither behind it, so the behaviour it stands for is written here instead, and each one does what the item of the
 * same name does: the editing and window entries do what their role does, and the File entries and About reach the very callbacks
 * the native items click, so that a file is never opened or closed by two different routes.
 *
 * This is also the whole of what the renderer is allowed to ask the main process to do: an unknown command name is ignored rather
 * than guessed at, and the one command that carries a value — the file *Open Recent* was asked for — is refused unless the recent
 * list actually offers it. The menu bridge therefore cannot become a way of reaching anything else.
 */

// What the window sent, before anything has decided whether it names a command this menu has. The renderer is typed against the
// closed set, so this is where a message that is not one of them stops.
export interface SpiccioliMenuCommandInput {
	command: string;
	filePath?: string;
}

// What a command needs of the rest of the application: the window the menu belongs to, and the callbacks the native File items click
export interface SpiccioliMenuCommandTarget {

	// Read again on every command rather than captured: the window can be closed and, on macOS, created again while the process lives
	getWindow: () => BrowserWindow | undefined;

	// A File action ends the current session and takes its closing copy, so it is the renderer that performs it
	onLedgerCommand: (command: LedgerMenuCommand) => void;

	onAbout: () => void;
	onQuit: () => void;

	// Whether Open Recent offers that file at all, which is what a path arriving from the window is checked against
	offersRecentFile: (filePath: string) => boolean;
}

// Chromium keeps zoom as a level rather than a factor, where every level is 1.2 times the previous one and 0 is the normal size
const zoomBy = (webContents: WebContents, steps: number): void => {
	const wantedLevel = webContents.getZoomLevel() + steps * ZOOM_CONFIG.stepLevel;

	webContents.setZoomLevel(Math.min(Math.max(wantedLevel, ZOOM_CONFIG.minimumLevel), ZOOM_CONFIG.maximumLevel));
};

// Keyed by command name, so an unknown one finds nothing to run instead of falling into a default case that does something
const COMMAND_HANDLERS: Record<
	SpiccioliMenuCommand,
	(window: BrowserWindow, target: SpiccioliMenuCommandTarget, request: SpiccioliMenuCommandInput) => void
> = {
	[SPICCIOLI_MENU_COMMANDS.newFile]: (_window, target) => {
		target.onLedgerCommand({ command: 'new-file' });
	},
	[SPICCIOLI_MENU_COMMANDS.openFile]: (_window, target) => {
		target.onLedgerCommand({ command: 'open-file' });
	},
	[SPICCIOLI_MENU_COMMANDS.openRecentFile]: (_window, target, request) => {
		// A path the recent list does not hold is not an entry of this menu, whatever the window says it picked
		if(request.filePath !== undefined && target.offersRecentFile(request.filePath)) {
			target.onLedgerCommand({ command: 'open-recent-file', filePath: request.filePath });
		}
	},
	[SPICCIOLI_MENU_COMMANDS.about]: (_window, target) => {
		target.onAbout();
	},
	[SPICCIOLI_MENU_COMMANDS.quit]: (_window, target) => {
		target.onQuit();
	},
	[SPICCIOLI_MENU_COMMANDS.undo]: (window) => {
		window.webContents.undo();
	},
	[SPICCIOLI_MENU_COMMANDS.redo]: (window) => {
		window.webContents.redo();
	},
	[SPICCIOLI_MENU_COMMANDS.cut]: (window) => {
		window.webContents.cut();
	},
	[SPICCIOLI_MENU_COMMANDS.copy]: (window) => {
		window.webContents.copy();
	},
	[SPICCIOLI_MENU_COMMANDS.paste]: (window) => {
		window.webContents.paste();
	},
	[SPICCIOLI_MENU_COMMANDS.selectAll]: (window) => {
		window.webContents.selectAll();
	},
	[SPICCIOLI_MENU_COMMANDS.resetZoom]: (window) => {
		window.webContents.setZoomLevel(0);
	},
	[SPICCIOLI_MENU_COMMANDS.zoomIn]: (window) => {
		zoomBy(window.webContents, 1);
	},
	[SPICCIOLI_MENU_COMMANDS.zoomOut]: (window) => {
		zoomBy(window.webContents, -1);
	},
	[SPICCIOLI_MENU_COMMANDS.toggleFullScreen]: (window) => {
		window.setFullScreen(!window.isFullScreen());
	},
	[SPICCIOLI_MENU_COMMANDS.minimize]: (window) => {
		window.minimize();
	},
	[SPICCIOLI_MENU_COMMANDS.close]: (window) => {
		// The close is the one the user asks for through the window button as well, so it goes through the same handler and takes the
		// closing copy of the session with it
		window.close();
	}
};

/**
 * Runs one entry of the menu bar Spiccioli draws.
 * @param request What the entry stands for, and the file it names where it names one. Anything that is not one of the known
 * commands does nothing.
 * @param target The window to run it against, and the callbacks the File entries share with the native menu.
 */
export const runSpiccioliMenuCommand = (request: SpiccioliMenuCommandInput, target: SpiccioliMenuCommandTarget): void => {
	const handler = COMMAND_HANDLERS[request.command as SpiccioliMenuCommand] as typeof COMMAND_HANDLERS[SpiccioliMenuCommand] | undefined;

	if(!handler) {
		return;
	}

	const window = target.getWindow();

	// A menu clicked while the window is going away has nothing left to act on, and the entries that quit or open a file need one
	// just as much: both are a close of the session the window is showing
	if(!window || window.isDestroyed()) {
		return;
	}

	handler(window, target, request);
};
