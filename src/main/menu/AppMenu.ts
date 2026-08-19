import path from 'node:path';
import type { MenuItemConstructorOptions } from 'electron';
import type { SpiccioliTranslator } from 'src/i18n/Translations';
import { SPICCIOLI_MENU_COMMANDS, type SpiccioliMenu, type SpiccioliNestedMenuItem } from 'src/types/AppMenuTypes';
import type { LedgerMenuCommand } from 'src/types/LedgerIpcTypes';
import type { RecentLedgerFile } from 'src/types/PreferencesTypes';

/**
 * The menu bar, of which exactly two things are Spiccioli's and everything else is the platform's business.
 *
 * **A File menu of four actions** — New…, Open…, Open Recent and Quit — and **an About item naming the application and its
 * version**, which is the only place a version number appears. Where About and Quit sit, and whether there is a Window or a Help
 * menu, follow each platform's own conventions.
 *
 * All four File actions end the current session and all four take its closing copy, so none of them acts here: each one is sent
 * to the renderer, which is the side that has to finish saving before the file can stop being the open one.
 *
 * Everything the two do not fix is an Electron role rather than a command of Spiccioli's own. A role brings its own label, its own
 * accelerator and its own behaviour, worded in the language the operating system runs in, which is closer than a bundled
 * translation gets. The Edit menu in particular is not decoration: on macOS the standard editing shortcuts are the accelerators of
 * those menu items, so a window without an Edit menu is a window where the user cannot copy or paste inside a field.
 *
 * **A development run gets three entries more** — reload, force reload and the developer tools — because they belong to a
 * development run and not to an installed application, where reloading throws away whatever has not been written and the tools are
 * an invitation to break things. They are added to this menu rather than left to the one Electron installs when nobody asks:
 * that default menu has no File menu, and without it a development run could neither create nor open a ledger.
 *
 * On Windows the menu is installed but never shown: the operating system draws it in its own grey, above a window that is dark, and
 * nothing in Electron can restyle it. The window there hides the menu bar and draws it in the renderer instead, in the colors of the
 * application, which is what "buildDrawnMenuBar()" describes. The hidden native menu stays installed because it is what answers the
 * keyboard: its roles carry the accelerators, so the drawn bar only has to say what they are and to run the same commands when it is
 * clicked.
 */

// The platforms disagree on where the application's own entries go, and on nothing else in this menu
export type MenuPlatform = typeof process.platform;

export interface BuildAppMenuTemplateOptions {
	translator: SpiccioliTranslator;
	isMac: boolean;
	recentFiles: readonly RecentLedgerFile[];

	// A development run is the only one that offers reload and the developer tools
	isDevelopmentRun: boolean;

	onCommand: (command: LedgerMenuCommand) => void;
	onAbout: () => void;
	onQuit: () => void;
}

// A recent entry whose file has moved is offered struck through on the launch screen; in a menu there is no such thing, so it is
// listed disabled instead and stays there until it is dismissed from the launch screen
const buildRecentFilesSubmenu = (
	translator: SpiccioliTranslator,
	recentFiles: readonly RecentLedgerFile[],
	onCommand: (command: LedgerMenuCommand) => void
): MenuItemConstructorOptions[] => {
	if(recentFiles.length === 0) {
		return [ {
			label: translator.t('menu.noRecentFiles'),
			enabled: false
		} ];
	}

	return recentFiles.map((recentFile) => {
		return {
			label: recentFile.missing ?
				translator.t('menu.missingRecentFile', { name: path.basename(recentFile.filePath) }) :
				path.basename(recentFile.filePath),
			enabled: !recentFile.missing,
			click: () => {
				onCommand({ command: 'open-recent-file', filePath: recentFile.filePath });
			}
		};
	});
};

// Zoom and full screen, and in a development run the three entries that belong to one
const buildViewSubmenu = (isDevelopmentRun: boolean): MenuItemConstructorOptions[] => {
	const viewItems: MenuItemConstructorOptions[] = [
		{ role: 'resetZoom' },
		{ role: 'zoomIn' },
		{ role: 'zoomOut' },
		{ type: 'separator' },
		{ role: 'togglefullscreen' }
	];

	if(!isDevelopmentRun) {
		return viewItems;
	}

	return [ ...viewItems, { type: 'separator' }, { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' } ];
};

/**
 * Builds the menu template for a platform.
 * @param options The wording, the platform, the recent list, and what each item does.
 * @param options.translator The wording.
 * @param options.isMac Whether this is macOS, which puts About and Quit in the application menu.
 * @param options.recentFiles The list Open Recent offers.
 * @param options.isDevelopmentRun Whether this run offers reload and the developer tools as well.
 * @param options.onCommand What a File action asks the renderer to do.
 * @param options.onAbout What the About item opens.
 * @param options.onQuit What Quit does.
 * @returns The template, ready for Electron to build a menu from.
 */
export const buildAppMenuTemplate = ({
	translator,
	isMac,
	recentFiles,
	isDevelopmentRun,
	onCommand,
	onAbout,
	onQuit
}: BuildAppMenuTemplateOptions): MenuItemConstructorOptions[] => {
	const aboutItem: MenuItemConstructorOptions = {
		label: translator.t('menu.about', { name: translator.t('app.name') }),
		click: () => {
			onAbout();
		}
	};
	const quitItem: MenuItemConstructorOptions = {
		label: translator.t('menu.quit'),
		accelerator: isMac ? 'Command+Q' : 'Control+Q',
		click: () => {
			onQuit();
		}
	};
	const fileItems: MenuItemConstructorOptions[] = [
		{
			label: translator.t('menu.newFile'),
			accelerator: 'CmdOrCtrl+N',
			click: () => {
				onCommand({ command: 'new-file' });
			}
		},
		{
			label: translator.t('menu.openFile'),
			accelerator: 'CmdOrCtrl+O',
			click: () => {
				onCommand({ command: 'open-file' });
			}
		},
		{
			label: translator.t('menu.openRecent'),
			submenu: buildRecentFilesSubmenu(translator, recentFiles, onCommand)
		}
	];

	const separator: MenuItemConstructorOptions = { type: 'separator' };

	// About and Quit sit in the application menu on macOS and in Help and File everywhere else, which is each platform's own convention
	const applicationMenu: MenuItemConstructorOptions[] = isMac ?
		[ {
			label: translator.t('app.name'),
			submenu: [ aboutItem, separator, { role: 'services' }, separator, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, separator, quitItem ]
		} ] :
		[];
	const helpMenu: MenuItemConstructorOptions[] = isMac ?
		[] :
		[ {
			label: translator.t('menu.help'),
			submenu: [ aboutItem ]
		} ];

	return [
		...applicationMenu,
		{
			label: translator.t('menu.file'),
			submenu: isMac ?
				fileItems :
				[ ...fileItems, separator, quitItem ]
		},

		// Undo, cut, copy, paste and select all, and on macOS the shortcuts for them
		{ role: 'editMenu' },

		{
			label: translator.t('menu.view'),
			submenu: buildViewSubmenu(isDevelopmentRun)
		},
		{ role: 'windowMenu' },
		...helpMenu
	];
};

export interface DrawsOwnMenuBarOptions {
	platform: MenuPlatform;

	// A development run keeps the native menu bar, which is where its reload and developer-tools entries stay reachable
	isDevelopmentRun: boolean;
}

/**
 * Tells whether Spiccioli draws the menu bar itself instead of leaving it to the operating system.
 * @param options Which platform and which kind of run this is.
 * @param options.platform The platform Spiccioli is running on.
 * @param options.isDevelopmentRun Whether this run keeps the native menu bar.
 * @returns True when the window hides the native menu bar and the renderer draws one.
 */
export const drawsOwnMenuBar = ({ platform, isDevelopmentRun }: DrawsOwnMenuBarOptions): boolean => {
	// macOS puts the menu in the system menu bar at the top of the screen, where it belongs to the desktop and not to the window, and
	// it already looks like every other application there. Linux is left alone as well: hiding the native menu bar there means taking
	// the window buttons over too, which its desktop environments draw in ways Spiccioli cannot reproduce.
	return platform === 'win32' && !isDevelopmentRun;
};

// What each drawn entry shows on its right. These are display text: the hidden native menu answers the keystroke through the
// accelerator its item carries, so an entry changed here has to keep saying what that item actually listens for.
const WINDOWS_ACCELERATORS = {
	newFile: 'Ctrl+N',
	openFile: 'Ctrl+O',
	quit: 'Ctrl+Q',
	undo: 'Ctrl+Z',
	redo: 'Ctrl+Y',
	cut: 'Ctrl+X',
	copy: 'Ctrl+C',
	paste: 'Ctrl+V',
	selectAll: 'Ctrl+A',
	resetZoom: 'Ctrl+0',
	zoomIn: 'Ctrl++',
	zoomOut: 'Ctrl+-',
	toggleFullScreen: 'F11',
	minimize: 'Ctrl+M',
	close: 'Ctrl+W'
} as const;

// The same list Open Recent offers natively, as rows of a drawn submenu: a file that has moved says so and does nothing, and an
// empty list is the one row saying it is empty
const buildDrawnRecentFilesItems = (translator: SpiccioliTranslator, recentFiles: readonly RecentLedgerFile[]): SpiccioliNestedMenuItem[] => {
	if(recentFiles.length === 0) {
		return [ { type: 'label', label: translator.t('menu.noRecentFiles') } ];
	}

	return recentFiles.map((recentFile) => {
		if(recentFile.missing) {
			return {
				type: 'label',
				label: translator.t('menu.missingRecentFile', { name: path.basename(recentFile.filePath) })
			};
		}

		return {
			type: 'entry',
			command: SPICCIOLI_MENU_COMMANDS.openRecentFile,
			label: path.basename(recentFile.filePath),
			filePath: recentFile.filePath
		};
	});
};

export interface BuildDrawnMenuBarOptions {
	translator: SpiccioliTranslator;
	recentFiles: readonly RecentLedgerFile[];
}

/**
 * Builds the menu bar the renderer draws, which is the same menu as the native one in the wording of the translation bundle.
 * The two are built separately on purpose: the native one is items and roles, so that Electron keeps owning the accelerators and
 * the behaviour, and this one is labels and command names, because a menu drawn in the window has to know what to write on each
 * entry.
 * @param options The wording and the recent list.
 * @param options.translator The wording of every submenu and every entry.
 * @param options.recentFiles The list Open Recent offers.
 * @returns The submenus, in the order they appear.
 */
export const buildDrawnMenuBar = ({ translator, recentFiles }: BuildDrawnMenuBarOptions): SpiccioliMenu[] => {
	return [
		{
			id: 'file',
			label: translator.t('menu.file'),
			items: [
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.newFile, label: translator.t('menu.newFile'), accelerator: WINDOWS_ACCELERATORS.newFile },
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.openFile, label: translator.t('menu.openFile'), accelerator: WINDOWS_ACCELERATORS.openFile },
				{ type: 'submenu', label: translator.t('menu.openRecent'), items: buildDrawnRecentFilesItems(translator, recentFiles) },
				{ type: 'separator' },
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.quit, label: translator.t('menu.quit'), accelerator: WINDOWS_ACCELERATORS.quit }
			]
		},
		{
			id: 'edit',
			label: translator.t('menu.edit'),
			items: [
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.undo, label: translator.t('menu.undo'), accelerator: WINDOWS_ACCELERATORS.undo },
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.redo, label: translator.t('menu.redo'), accelerator: WINDOWS_ACCELERATORS.redo },
				{ type: 'separator' },
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.cut, label: translator.t('menu.cut'), accelerator: WINDOWS_ACCELERATORS.cut },
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.copy, label: translator.t('menu.copy'), accelerator: WINDOWS_ACCELERATORS.copy },
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.paste, label: translator.t('menu.paste'), accelerator: WINDOWS_ACCELERATORS.paste },
				{ type: 'separator' },
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.selectAll, label: translator.t('menu.selectAll'), accelerator: WINDOWS_ACCELERATORS.selectAll }
			]
		},
		{
			id: 'view',
			label: translator.t('menu.view'),
			items: [
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.resetZoom, label: translator.t('menu.resetZoom'), accelerator: WINDOWS_ACCELERATORS.resetZoom },
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.zoomIn, label: translator.t('menu.zoomIn'), accelerator: WINDOWS_ACCELERATORS.zoomIn },
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.zoomOut, label: translator.t('menu.zoomOut'), accelerator: WINDOWS_ACCELERATORS.zoomOut },
				{ type: 'separator' },
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.toggleFullScreen, label: translator.t('menu.toggleFullScreen'), accelerator: WINDOWS_ACCELERATORS.toggleFullScreen }
			]
		},
		{
			id: 'window',
			label: translator.t('menu.window'),
			items: [
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.minimize, label: translator.t('menu.minimize'), accelerator: WINDOWS_ACCELERATORS.minimize },
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.close, label: translator.t('menu.close'), accelerator: WINDOWS_ACCELERATORS.close }
			]
		},
		{
			id: 'help',
			label: translator.t('menu.help'),
			items: [
				{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.about, label: translator.t('menu.about', { name: translator.t('app.name') }) }
			]
		}
	];
};
