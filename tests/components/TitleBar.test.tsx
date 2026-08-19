import { screen, waitFor, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderOpenLedger, renderWithProviders, stubAppMenuBridge, stubLedgerBridge } from '../testUtils';
import { TitleBar } from 'src/components/shell/TitleBar';
import { SPICCIOLI_MENU_COMMANDS, type SpiccioliMenu, type SpiccioliMenuCommandRequest } from 'src/types/AppMenuTypes';

const RECENT_FILE_PATH = '/Documents/finances.spiccioli';

const MENUS: SpiccioliMenu[] = [
	{
		id: 'file',
		label: 'File',
		items: [
			{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.newFile, label: 'New…', accelerator: 'Ctrl+N' },
			{
				type: 'submenu',
				label: 'Open Recent',
				items: [ { type: 'entry', command: SPICCIOLI_MENU_COMMANDS.openRecentFile, label: 'finances.spiccioli', filePath: RECENT_FILE_PATH } ]
			},
			{ type: 'separator' },
			{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.quit, label: 'Quit', accelerator: 'Ctrl+Q' }
		]
	},
	{
		id: 'view',
		label: 'View',
		items: [ { type: 'entry', command: SPICCIOLI_MENU_COMMANDS.zoomIn, label: 'Zoom In', accelerator: 'Ctrl++' } ]
	}
];

const renderTitleBar = (menus: SpiccioliMenu[]): { requests: SpiccioliMenuCommandRequest[]; view: RenderResult } => {
	const requests: SpiccioliMenuCommandRequest[] = [];

	stubLedgerBridge();
	stubAppMenuBridge({
		getMenuBar: () => {
			return Promise.resolve(menus);
		},
		runMenuCommand: (request) => {
			requests.push(request);
			return Promise.resolve();
		}
	});
	return { requests, view: renderWithProviders(<TitleBar/>) };
};

describe('the drawn title bar', () => {
	// Every platform whose window keeps its own title bar is answered with no menu at all, and the row draws nothing
	test('draws nothing where the window keeps its own title bar', async() => {
		const { view } = renderTitleBar([]);

		await waitFor(() => {
			expect(view.container).toBeEmptyDOMElement();
		});
		expect(screen.queryByRole('menubar')).not.toBeInTheDocument();
	});

	// On this platform the drawn row is where the window title is read, and with no file open it is the application's name alone
	test('names the application while no file is open', async() => {
		renderTitleBar(MENUS);

		expect(await screen.findByRole('menubar')).toBeInTheDocument();
		expect(screen.getAllByText('Spiccioli').length).toBeGreaterThan(0);
	});

	// The window title is where the current file is named, and where the window has no title bar of its own this row is it
	test('names the open file, the way the window title does', async() => {
		stubAppMenuBridge({
			getMenuBar: () => {
				return Promise.resolve(MENUS);
			}
		});
		await renderOpenLedger();

		expect(await screen.findByText('finances — Spiccioli')).toBeInTheDocument();
	});

	test('opens a submenu on the first click and runs the entry that is picked', async() => {
		const { requests } = renderTitleBar(MENUS);

		await userEvent.click(await screen.findByRole('menuitem', { name: 'File' }));
		await userEvent.click(screen.getByRole('menuitem', { name: /New…/ }));

		expect(requests).toEqual([ { command: SPICCIOLI_MENU_COMMANDS.newFile, filePath: undefined } ]);
		expect(screen.queryByRole('menuitem', { name: /New…/ })).not.toBeInTheDocument();
	});

	// Open Recent is the one submenu of a submenu the menu has, and the file it names is what the entry carries
	test('opens Open Recent by pointing at it, and names the file it opens', async() => {
		const { requests } = renderTitleBar(MENUS);

		await userEvent.click(await screen.findByRole('menuitem', { name: 'File' }));
		await userEvent.hover(screen.getByRole('menuitem', { name: /Open Recent/ }));
		await userEvent.click(await screen.findByRole('menuitem', { name: 'finances.spiccioli' }));

		expect(requests).toEqual([ { command: SPICCIOLI_MENU_COMMANDS.openRecentFile, filePath: RECENT_FILE_PATH } ]);
	});

	// The keyboard walks the bar the way it walks the menu bar it replaces
	test('walks the menu with the arrow keys', async() => {
		const { requests } = renderTitleBar(MENUS);

		(await screen.findByRole('menuitem', { name: 'File' })).focus();
		await userEvent.keyboard('{ArrowDown}');
		await userEvent.keyboard('{ArrowRight}');
		await userEvent.keyboard('{ArrowDown}{Enter}');

		expect(requests).toEqual([ { command: SPICCIOLI_MENU_COMMANDS.zoomIn, filePath: undefined } ]);
	});

	// The recent list changes every time a file is opened, so the drawn bar is told rather than left to ask again
	test('redraws itself when the main process rebuilds the menu', async() => {
		let publish: ((menus: SpiccioliMenu[]) => void) | undefined;

		stubLedgerBridge();
		stubAppMenuBridge({
			getMenuBar: () => {
				return Promise.resolve([]);
			},
			onMenuBarChanged: (listener) => {
				publish = listener;

				return () => {
					publish = undefined;
				};
			}
		});

		const view = renderWithProviders(<TitleBar/>);

		await waitFor(() => {
			expect(view.container).toBeEmptyDOMElement();
		});
		publish?.(MENUS);

		expect(await screen.findByRole('menuitem', { name: 'File' })).toBeInTheDocument();
	});
});
