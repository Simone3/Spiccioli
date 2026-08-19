import type { MenuItemConstructorOptions } from 'electron';
import { makeTranslator } from '../testUtils';
import { buildAppMenuTemplate, buildDrawnMenuBar, drawsOwnMenuBar, type BuildAppMenuTemplateOptions } from 'src/main/menu/AppMenu';
import { SPICCIOLI_MENU_COMMANDS, type SpiccioliMenu, type SpiccioliMenuItem } from 'src/types/AppMenuTypes';
import type { LedgerMenuCommand } from 'src/types/LedgerIpcTypes';
import type { RecentLedgerFile } from 'src/types/PreferencesTypes';

const translator = makeTranslator();

const RECENT_FILE: RecentLedgerFile = { filePath: '/Documents/finances.spiccioli', lastOpenedAt: '2026-08-08T14:32:00.000Z', missing: false };

const buildTemplate = (overrides: Partial<BuildAppMenuTemplateOptions> = {}): MenuItemConstructorOptions[] => {
	return buildAppMenuTemplate({
		translator,
		isMac: false,
		recentFiles: [],
		isDevelopmentRun: false,
		onCommand: () => {
			return undefined;
		},
		onAbout: () => {
			return undefined;
		},
		onQuit: () => {
			return undefined;
		},
		...overrides
	});
};

const findSubmenu = (template: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions[] => {
	const submenu = template.find((item) => {
		return item.label === label;
	})?.submenu;

	return Array.isArray(submenu) ? submenu : [];
};

const getRoles = (items: MenuItemConstructorOptions[]): (string | undefined)[] => {
	return items.map((item) => {
		return item.role;
	});
};

const getLabels = (items: MenuItemConstructorOptions[]): (string | undefined)[] => {
	return items.map((item) => {
		return item.label;
	});
};

const findDrawnMenu = (menus: SpiccioliMenu[], id: string): SpiccioliMenuItem[] => {
	return menus.find((menu) => {
		return menu.id === id;
	})?.items ?? [];
};

describe('buildAppMenuTemplate', () => {
	// The File menu of four actions is one of the two things the menu bar must carry, whatever the platform does with the rest
	test('offers the four File actions, with Quit in the File menu off macOS', () => {
		expect(getLabels(findSubmenu(buildTemplate(), translator.t('menu.file')))).toEqual([
			translator.t('menu.newFile'),
			translator.t('menu.openFile'),
			translator.t('menu.openRecent'),
			undefined,
			translator.t('menu.quit')
		]);
	});

	// macOS puts About and Quit in the application menu, which is where its users look for them
	test('puts About and Quit in the application menu on macOS', () => {
		const template = buildTemplate({ isMac: true });
		const applicationItems = findSubmenu(template, translator.t('app.name'));

		expect(getLabels(applicationItems)).toContain(translator.t('menu.about', { name: translator.t('app.name') }));
		expect(getLabels(applicationItems)).toContain(translator.t('menu.quit'));
		expect(getLabels(findSubmenu(template, translator.t('menu.file')))).not.toContain(translator.t('menu.quit'));
		expect(getLabels(template)).not.toContain(translator.t('menu.help'));
	});

	// The About item is the other thing the menu bar must carry, and off macOS a Help menu is where the platform expects it
	test('offers About in a Help menu off macOS', () => {
		expect(getLabels(findSubmenu(buildTemplate(), translator.t('menu.help')))).toEqual([
			translator.t('menu.about', { name: translator.t('app.name') })
		]);
	});

	// On macOS the standard editing shortcuts are the accelerators of these items, so a window without them is one where the user
	// cannot copy or paste inside a field
	test.each([ true, false ])('leaves editing and the window to their roles, on macOS %s', (isMac) => {
		expect(getRoles(buildTemplate({ isMac }))).toEqual(expect.arrayContaining([ 'editMenu', 'windowMenu' ]));
	});

	test('offers zoom and full screen under View', () => {
		expect(getRoles(findSubmenu(buildTemplate(), translator.t('menu.view')))).toEqual([
			'resetZoom',
			'zoomIn',
			'zoomOut',
			undefined,
			'togglefullscreen'
		]);
	});

	// Reloading throws away whatever has not been written and the tools are an invitation to break things, so an installed
	// Spiccioli offers neither
	test('offers reload and the developer tools in a development run only', () => {
		expect(getRoles(findSubmenu(buildTemplate({ isDevelopmentRun: true }), translator.t('menu.view')))).toEqual(
			expect.arrayContaining([ 'reload', 'forceReload', 'toggleDevTools' ])
		);
		expect(getRoles(findSubmenu(buildTemplate(), translator.t('menu.view')))).not.toContain('toggleDevTools');
	});

	test('says so rather than offering an empty Open Recent', () => {
		const recentItems = findSubmenu(findSubmenu(buildTemplate(), translator.t('menu.file')), translator.t('menu.openRecent'));

		expect(recentItems).toEqual([ { label: translator.t('menu.noRecentFiles'), enabled: false } ]);
	});

	// A recent entry whose file has moved is offered struck through on the launch screen; in a menu there is no such thing, so it
	// is listed disabled instead
	test('lists a recent file that has moved, disabled', () => {
		const recentItems = findSubmenu(
			findSubmenu(buildTemplate({ recentFiles: [ { ...RECENT_FILE, missing: true } ] }), translator.t('menu.file')),
			translator.t('menu.openRecent')
		);

		expect(recentItems[0]?.label).toBe(translator.t('menu.missingRecentFile', { name: 'finances.spiccioli' }));
		expect(recentItems[0]?.enabled).toBe(false);
	});

	// A File action ends the session, so it is asked of the renderer rather than performed here
	test('asks the renderer to open a recent file rather than opening it', () => {
		const commands: LedgerMenuCommand[] = [];
		const template = buildTemplate({
			recentFiles: [ RECENT_FILE ],
			onCommand: (command) => {
				commands.push(command);
			}
		});
		const recentItems = findSubmenu(findSubmenu(template, translator.t('menu.file')), translator.t('menu.openRecent'));

		recentItems[0]?.click?.(undefined as never, undefined, undefined as never);

		expect(commands).toEqual([ { command: 'open-recent-file', filePath: RECENT_FILE.filePath } ]);
	});
});

describe('drawsOwnMenuBar', () => {
	// The operating system draws the menu bar there in its own grey, above a window that is dark, and nothing in Electron can restyle it
	test('draws its own on Windows', () => {
		expect(drawsOwnMenuBar({ platform: 'win32', isDevelopmentRun: false })).toBe(true);
	});

	// macOS puts the menu in the system menu bar, and hiding it on Linux would mean taking the window buttons over too
	test.each([ 'darwin', 'linux' ] as const)('leaves the menu bar to %s', (platform) => {
		expect(drawsOwnMenuBar({ platform, isDevelopmentRun: false })).toBe(false);
	});

	// A development run keeps the native bar, which is where its reload and developer-tools entries stay reachable
	test('leaves the menu bar alone in a development run', () => {
		expect(drawsOwnMenuBar({ platform: 'win32', isDevelopmentRun: true })).toBe(false);
	});
});

describe('buildDrawnMenuBar', () => {
	test('says the same menu as the native one', () => {
		const menus = buildDrawnMenuBar({ translator, recentFiles: [ RECENT_FILE ] });

		expect(menus.map((menu) => {
			return menu.id;
		})).toEqual([ 'file', 'edit', 'view', 'window', 'help' ]);
		expect(findDrawnMenu(menus, 'file')).toEqual([
			{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.newFile, label: translator.t('menu.newFile'), accelerator: 'Ctrl+N' },
			{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.openFile, label: translator.t('menu.openFile'), accelerator: 'Ctrl+O' },
			{
				type: 'submenu',
				label: translator.t('menu.openRecent'),
				items: [ { type: 'entry', command: SPICCIOLI_MENU_COMMANDS.openRecentFile, label: 'finances.spiccioli', filePath: RECENT_FILE.filePath } ]
			},
			{ type: 'separator' },
			{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.quit, label: translator.t('menu.quit'), accelerator: 'Ctrl+Q' }
		]);
	});

	// The one place a version number appears has to be in this menu too, because on Windows it is the only menu the user sees
	test('carries the About item', () => {
		const menus = buildDrawnMenuBar({ translator, recentFiles: [] });

		expect(findDrawnMenu(menus, 'help')).toEqual([
			{ type: 'entry', command: SPICCIOLI_MENU_COMMANDS.about, label: translator.t('menu.about', { name: translator.t('app.name') }) }
		]);
	});

	// A row that says something and does nothing, because a drawn menu has no disabled control to offer instead
	test.each([
		{ what: 'an empty list', recentFiles: [], label: translator.t('menu.noRecentFiles') },
		{ what: 'a file that has moved', recentFiles: [ { ...RECENT_FILE, missing: true } ], label: translator.t('menu.missingRecentFile', { name: 'finances.spiccioli' }) }
	])('states $what in Open Recent rather than offering it', ({ recentFiles, label }) => {
		const fileItems = findDrawnMenu(buildDrawnMenuBar({ translator, recentFiles }), 'file');
		const openRecent = fileItems.find((item) => {
			return item.type === 'submenu';
		});

		expect(openRecent?.type === 'submenu' ? openRecent.items : []).toEqual([ { type: 'label', label } ]);
	});
});
