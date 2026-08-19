/**
 * The menu bar Spiccioli draws itself, on the platform where the native one cannot be made to look like the rest of the application.
 *
 * The description travels from the main process to the renderer, and what the renderer sends back is only ever one of the command
 * names below: the menu is data on the way out and a closed set of commands on the way in, so nothing in the window can ask the main
 * process for anything the menu does not already offer. The one command that carries a value with it — the file *Open Recent* was
 * asked for — is checked against the recent list before it is acted on, for the same reason.
 */

// What a menu entry does. The main process owns the behaviour of each one, the same way an Electron role owns the behaviour it brings.
export const SPICCIOLI_MENU_COMMANDS = {
	newFile: 'new-file',
	openFile: 'open-file',
	openRecentFile: 'open-recent-file',
	about: 'about',
	quit: 'quit',
	undo: 'undo',
	redo: 'redo',
	cut: 'cut',
	copy: 'copy',
	paste: 'paste',
	selectAll: 'select-all',
	resetZoom: 'reset-zoom',
	zoomIn: 'zoom-in',
	zoomOut: 'zoom-out',
	toggleFullScreen: 'toggle-full-screen',
	minimize: 'minimize',
	close: 'close'
} as const;

export type SpiccioliMenuCommand = typeof SPICCIOLI_MENU_COMMANDS[keyof typeof SPICCIOLI_MENU_COMMANDS];

// What the renderer sends when an entry is picked: the command, and for "Open Recent" the file that entry stands for
export interface SpiccioliMenuCommandRequest {
	command: SpiccioliMenuCommand;
	filePath?: string;
}

export interface SpiccioliMenuEntry {

	type: 'entry';
	command: SpiccioliMenuCommand;
	label: string;

	// Which file this entry opens, on the entries of "Open Recent" and on no others
	filePath?: string;

	// What the entry shows on its right, as the accelerator of the matching item of the hidden native menu is written. The native menu
	// is what actually answers the keystroke, so this is the one place where the two have to be kept saying the same thing.
	accelerator?: string;
}

// A row that says something and does nothing: the empty "Open Recent", and a recent file that has moved. Both are what the native
// menu lists disabled, and neither is a control here either.
export interface SpiccioliMenuLabel {
	type: 'label';
	label: string;
}

export interface SpiccioliMenuSeparator {
	type: 'separator';
}

// What a submenu of a submenu may hold, which is everything but another submenu: the menu nests one level and no further
export type SpiccioliNestedMenuItem = SpiccioliMenuEntry | SpiccioliMenuLabel | SpiccioliMenuSeparator;

// One level of nesting, which is all the menu has: "Open Recent" and nothing else
export interface SpiccioliMenuSubmenu {
	type: 'submenu';
	label: string;
	items: SpiccioliNestedMenuItem[];
}

export type SpiccioliMenuItem = SpiccioliNestedMenuItem | SpiccioliMenuSubmenu;

export interface SpiccioliMenu {

	// Identifies the submenu for the renderer, which needs a key that survives a translated label
	id: string;
	label: string;
	items: SpiccioliMenuItem[];
}

export interface SpiccioliAppMenuApi {

	// Empty on every platform and every run that keeps a native menu bar, which is what tells the renderer to draw nothing at all
	getMenuBar: () => Promise<SpiccioliMenu[]>;

	runMenuCommand: (request: SpiccioliMenuCommandRequest) => Promise<void>;

	// "Open Recent" changes every time a file is opened, so the drawn bar is told rather than left to ask again
	onMenuBarChanged: (listener: (menus: SpiccioliMenu[]) => void) => () => void;
}
