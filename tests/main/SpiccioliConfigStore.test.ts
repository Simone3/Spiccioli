import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RECENT_FILES_CONFIG } from 'src/config/AppConfig';
import { resetAppLoggerForTests } from 'src/framework/main/logging/AppLogger';
import { DEFAULT_PREFERENCES } from 'src/logic/preferences/Preferences';
import { createSpiccioliConfigStore, type SpiccioliConfigStore } from 'src/main/config/SpiccioliConfigStore';

const tempDirectories: string[] = [];

const makeStore = (presentFiles: string[] = []): { store: SpiccioliConfigStore; configFilePath: string } => {
	const directory = mkdtempSync(path.join(tmpdir(), 'spiccioli-config-'));
	tempDirectories.push(directory);

	const configFilePath = path.join(directory, 'spiccioli-config.json');

	return {
		configFilePath,
		store: createSpiccioliConfigStore({
			configFilePath,
			fileExists: (filePath) => {
				return presentFiles.includes(filePath);
			},
			now: () => {
				return new Date(2026, 7, 8, 14, 32);
			}
		})
	};
};

beforeEach(() => {
	resetAppLoggerForTests();
});

afterEach(() => {
	while(tempDirectories.length > 0) {
		rmSync(tempDirectories.pop() as string, { recursive: true, force: true });
	}
});

describe('the preferences', () => {
	test('read as the defaults before anything has been written', () => {
		expect(makeStore().store.readPreferences()).toEqual(DEFAULT_PREFERENCES);
	});

	test('are written the moment one changes, and read back', () => {
		const { store } = makeStore();

		store.writePreferences({ ...DEFAULT_PREFERENCES, backupCount: 25 });

		expect(store.readPreferences().backupCount).toBe(25);
	});

	test('read as the defaults again when the file is corrupted, rather than blocking the application', () => {
		const { store, configFilePath } = makeStore();
		store.writePreferences({ ...DEFAULT_PREFERENCES, backupCount: 25 });
		writeFileSync(configFilePath, 'not json at all', 'utf8');

		expect(store.readPreferences()).toEqual(DEFAULT_PREFERENCES);
	});
});

describe('the recent-file list', () => {
	test('is empty on a first startup', () => {
		expect(makeStore().store.readRecentFiles()).toEqual([]);
	});

	test('puts the most recently opened file first and never lists one twice', () => {
		const { store } = makeStore([ '/a.spiccioli', '/b.spiccioli' ]);

		store.rememberRecentFile('/a.spiccioli');
		store.rememberRecentFile('/b.spiccioli');
		store.rememberRecentFile('/a.spiccioli');

		expect(store.readRecentFiles().map((recentFile) => {
			return recentFile.filePath;
		})).toEqual([ '/a.spiccioli', '/b.spiccioli' ]);
	});

	test('marks an entry whose file has moved, and keeps it until it is dismissed', () => {
		const { store } = makeStore([ '/here.spiccioli' ]);

		store.rememberRecentFile('/here.spiccioli');
		store.rememberRecentFile('/gone.spiccioli');

		expect(store.readRecentFiles()).toEqual([
			{ filePath: '/gone.spiccioli', lastOpenedAt: expect.any(String), missing: true },
			{ filePath: '/here.spiccioli', lastOpenedAt: expect.any(String), missing: false }
		]);

		expect(store.dismissRecentFile('/gone.spiccioli').map((recentFile) => {
			return recentFile.filePath;
		})).toEqual([ '/here.spiccioli' ]);
	});

	test('is bounded, so the configuration file cannot grow without limit', () => {
		const { store } = makeStore();

		for(let index = 0; index < RECENT_FILES_CONFIG.maximumEntries + 5; index += 1) {
			store.rememberRecentFile(`/ledger-${index}.spiccioli`);
		}

		expect(store.readRecentFiles()).toHaveLength(RECENT_FILES_CONFIG.maximumEntries);
	});

	test('keeps the preferences and the recent list in the one file, each surviving a write of the other', () => {
		const { store, configFilePath } = makeStore([ '/a.spiccioli' ]);

		store.writePreferences({ ...DEFAULT_PREFERENCES, backupCount: 7 });
		store.rememberRecentFile('/a.spiccioli');

		expect(store.readPreferences().backupCount).toBe(7);
		expect(readFileSync(configFilePath, 'utf8')).toContain('/a.spiccioli');
	});
});
