import path from 'node:path';
import type { MenuItemConstructorOptions } from 'electron';
import type { SpiccioliTranslator } from 'src/i18n/Translations';
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
 */

export interface BuildAppMenuTemplateOptions {
	translator: SpiccioliTranslator;
	isMac: boolean;
	recentFiles: readonly RecentLedgerFile[];
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

/**
 * Builds the menu template for a platform.
 * @param options The wording, the platform, the recent list, and what each item does.
 * @param options.translator The wording.
 * @param options.isMac Whether this is macOS, which puts About and Quit in the application menu.
 * @param options.recentFiles The list Open Recent offers.
 * @param options.onCommand What a File action asks the renderer to do.
 * @param options.onAbout What the About item opens.
 * @param options.onQuit What Quit does.
 * @returns The template, ready for Electron to build a menu from.
 */
export const buildAppMenuTemplate = ({
	translator,
	isMac,
	recentFiles,
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
		{
			label: translator.t('menu.edit'),
			submenu: [ { role: 'undo' }, { role: 'redo' }, separator, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' } ]
		},
		...helpMenu
	];
};
