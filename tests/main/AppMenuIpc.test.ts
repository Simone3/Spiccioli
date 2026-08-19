import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';
import { ZOOM_CONFIG } from 'src/config/AppConfig';
import { registerAppMenuIpcHandlers, SPICCIOLI_APP_MENU_IPC_CHANNELS } from 'src/main/ipc/AppMenuIpc';
import type { SpiccioliMenuCommandTarget } from 'src/main/menu/MenuCommands';
import { SPICCIOLI_MENU_COMMANDS, type SpiccioliMenu } from 'src/types/AppMenuTypes';
import type { LedgerMenuCommand } from 'src/types/LedgerIpcTypes';

type RegisteredIpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const RECENT_FILE_PATH = '/Documents/finances.spiccioli';

const MENU_BAR: SpiccioliMenu[] = [ { id: 'file', label: 'File', items: [] } ];

interface MenuTestHarness {
	run: (request: unknown) => void;
	getMenuBar: () => unknown;
	commands: LedgerMenuCommand[];
	window: {
		zoomLevel: number;
		fullScreen: boolean;
		closed: boolean;
		minimized: boolean;
		selectedAll: boolean;
	};
	aboutCount: () => number;
	quitCount: () => number;
}

const createHarness = (overrides: Partial<SpiccioliMenuCommandTarget> = {}, menuBar: SpiccioliMenu[] = MENU_BAR): MenuTestHarness => {
	const handlers = new Map<string, RegisteredIpcHandler>();
	const commands: LedgerMenuCommand[] = [];
	const windowState = { zoomLevel: 0, fullScreen: false, closed: false, minimized: false, selectedAll: false };
	let aboutCount = 0;
	let quitCount = 0;

	const window = {
		isDestroyed: () => {
			return false;
		},
		isFullScreen: () => {
			return windowState.fullScreen;
		},
		setFullScreen: (fullScreen: boolean) => {
			windowState.fullScreen = fullScreen;
		},
		minimize: () => {
			windowState.minimized = true;
		},
		close: () => {
			windowState.closed = true;
		},
		webContents: {
			getZoomLevel: () => {
				return windowState.zoomLevel;
			},
			setZoomLevel: (level: number) => {
				windowState.zoomLevel = level;
			},
			selectAll: () => {
				windowState.selectedAll = true;
			}
		}
	} as unknown as BrowserWindow;

	registerAppMenuIpcHandlers({
		ipcMain: {
			handle: (channel: string, handler: RegisteredIpcHandler) => {
				handlers.set(channel, handler);
			}
		} as unknown as Pick<IpcMain, 'handle'>,
		getMenuBar: () => {
			return menuBar;
		},
		commandTarget: {
			getWindow: () => {
				return window;
			},
			onLedgerCommand: (command) => {
				commands.push(command);
			},
			onAbout: () => {
				aboutCount += 1;
			},
			onQuit: () => {
				quitCount += 1;
			},
			offersRecentFile: (filePath) => {
				return filePath === RECENT_FILE_PATH;
			},
			...overrides
		}
	});

	return {
		run: (request) => {
			handlers.get(SPICCIOLI_APP_MENU_IPC_CHANNELS.runMenuCommand)?.(undefined as unknown as IpcMainInvokeEvent, request);
		},
		getMenuBar: () => {
			return handlers.get(SPICCIOLI_APP_MENU_IPC_CHANNELS.getMenuBar)?.(undefined as unknown as IpcMainInvokeEvent);
		},
		commands,
		window: windowState,
		aboutCount: () => {
			return aboutCount;
		},
		quitCount: () => {
			return quitCount;
		}
	};
};

describe('AppMenuIpc', () => {
	test('answers with the menu the main process is publishing', () => {
		expect(createHarness().getMenuBar()).toEqual(MENU_BAR);
	});

	// A platform that keeps its native menu bar is answered with nothing at all, which is what tells the renderer to draw none
	test('answers with no menu at all where the window keeps its own', () => {
		expect(createHarness({}, []).getMenuBar()).toEqual([]);
	});

	// A File action ends the session and takes its closing copy, so it is asked of the renderer exactly as the native item asks it
	test('asks the renderer for the File actions', () => {
		const harness = createHarness();

		harness.run({ command: SPICCIOLI_MENU_COMMANDS.newFile });
		harness.run({ command: SPICCIOLI_MENU_COMMANDS.openFile });

		expect(harness.commands).toEqual([ { command: 'new-file' }, { command: 'open-file' } ]);
	});

	test('opens a recent file the menu offers', () => {
		const harness = createHarness();

		harness.run({ command: SPICCIOLI_MENU_COMMANDS.openRecentFile, filePath: RECENT_FILE_PATH });

		expect(harness.commands).toEqual([ { command: 'open-recent-file', filePath: RECENT_FILE_PATH } ]);
	});

	// The one command that carries a value is the one thing a window could name for itself, so it is refused unless the recent
	// list actually holds it
	test('refuses a path the recent list does not hold', () => {
		const harness = createHarness();

		harness.run({ command: SPICCIOLI_MENU_COMMANDS.openRecentFile, filePath: '/elsewhere/other.spiccioli' });
		harness.run({ command: SPICCIOLI_MENU_COMMANDS.openRecentFile });

		expect(harness.commands).toEqual([]);
	});

	test('runs the window and editing entries against the window', () => {
		const harness = createHarness();

		harness.run({ command: SPICCIOLI_MENU_COMMANDS.selectAll });
		harness.run({ command: SPICCIOLI_MENU_COMMANDS.toggleFullScreen });
		harness.run({ command: SPICCIOLI_MENU_COMMANDS.minimize });
		harness.run({ command: SPICCIOLI_MENU_COMMANDS.close });

		expect(harness.window).toEqual({ zoomLevel: 0, fullScreen: true, closed: true, minimized: true, selectedAll: true });
	});

	// Chromium clamps zoom itself, but only far past the point where a table of figures is unusable
	test('zooms by one level at a time and no further than the ceiling', () => {
		const harness = createHarness();

		harness.run({ command: SPICCIOLI_MENU_COMMANDS.zoomIn });
		expect(harness.window.zoomLevel).toBe(ZOOM_CONFIG.stepLevel);

		for(let attempt = 0; attempt < 20; attempt++) {
			harness.run({ command: SPICCIOLI_MENU_COMMANDS.zoomIn });
		}
		expect(harness.window.zoomLevel).toBe(ZOOM_CONFIG.maximumLevel);

		harness.run({ command: SPICCIOLI_MENU_COMMANDS.resetZoom });
		expect(harness.window.zoomLevel).toBe(0);
	});

	test('opens the About box and quits through the same callbacks the native menu clicks', () => {
		const harness = createHarness();

		harness.run({ command: SPICCIOLI_MENU_COMMANDS.about });
		harness.run({ command: SPICCIOLI_MENU_COMMANDS.quit });

		expect([ harness.aboutCount(), harness.quitCount() ]).toEqual([ 1, 1 ]);
	});

	// An unknown command can only come from a renderer asking for something this menu does not offer, and is ignored rather than
	// guessed at
	test.each([
		{ what: 'an unknown command', request: { command: 'open-a-terminal' } },
		{ what: 'a command that is not a name', request: { command: 42 } },
		{ what: 'nothing at all', request: undefined }
	])('ignores $what', ({ request }) => {
		const harness = createHarness();

		harness.run(request);

		expect(harness.commands).toEqual([]);
		expect(harness.quitCount()).toBe(0);
	});

	// A menu clicked while the window is going away has nothing left to act on
	test('does nothing once the window is gone', () => {
		const harness = createHarness({
			getWindow: () => {
				return undefined;
			}
		});

		harness.run({ command: SPICCIOLI_MENU_COMMANDS.newFile });

		expect(harness.commands).toEqual([]);
	});
});
