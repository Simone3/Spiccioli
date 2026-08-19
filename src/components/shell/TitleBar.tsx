import 'src/components/shell/TitleBar.css';
import { useEffect, useState, type ReactElement } from 'react';
import { MenuBar } from 'src/components/shell/MenuBar';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { getFileNameWithoutExtension } from 'src/logic/format/FilePathDisplay';
import { loadDrawnMenuBar, runMenuCommand, subscribeToDrawnMenuBar } from 'src/logic/menu/DrawnMenu';
import type { SpiccioliMenu } from 'src/types/AppMenuTypes';

/**
 * The row Spiccioli draws in place of the title bar the operating system would.
 *
 * It exists only where the main process hid the native one, which today is Windows: the menu bar there is drawn by the operating
 * system in a grey nothing can change, above a window that is dark, and the two never look like one application. Everywhere else the
 * main process answers with no menu at all, this renders nothing, and the window keeps the title bar and the menu bar it has always
 * had. The window buttons are never drawn here: Electron keeps overlaying the real ones on the right of this row, in the colors it
 * was given, so minimizing, maximizing and closing stay the operating system's own.
 *
 * **The title is the same one the window carries**, because on this platform the row is where it is read: the file's name and
 * nothing else, and the application's name alone while no file is open.
 */

// The main process is the only side that knows whether the native menu bar was hidden, so the menu is asked for when the row mounts
// and pushed again every time the recent list changes Open Recent underneath it
const useDrawnMenuBar = (): SpiccioliMenu[] => {
	const [ menus, setMenus ] = useState<SpiccioliMenu[]>([]);

	useEffect(() => {
		let didCancelLoad = false;

		void loadDrawnMenuBar().then((loadedMenus) => {
			if(!didCancelLoad) {
				setMenus(loadedMenus);
			}
		});

		const unsubscribe = subscribeToDrawnMenuBar(setMenus);

		return () => {
			didCancelLoad = true;
			unsubscribe();
		};
	}, []);

	return menus;
};

/**
 * The drawn title bar.
 * @returns The row, or nothing at all where the window keeps its own title bar.
 */
export const TitleBar = (): ReactElement | null => {
	const { t } = useTranslator();
	const { filePath } = useLedger();
	const menus = useDrawnMenuBar();

	if(menus.length === 0) {
		return null;
	}

	const title = filePath === undefined ?
		t('app.name') :
		t('window.titleWithFile', { name: getFileNameWithoutExtension(filePath), app: t('app.name') });

	return (
		<div id='title-bar'>
			<MenuBar menus={menus} onCommand={runMenuCommand}/>
			<div className='title-bar-title'>{title}</div>
		</div>
	);
};
