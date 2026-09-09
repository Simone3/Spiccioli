import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBackupLocationManager, type BackupSettingsStore, type StoredBackupSettings } from 'src/framework/main/config/BackupLocationManager';
import type { RuntimePaths } from 'src/framework/main/config/RuntimePaths';
import { initializeAppLogger, resetAppLoggerForTests } from 'src/framework/main/logging/AppLogger';
import type { BackupDirectoryMessages } from 'src/framework/main/storage/BackupDirectory';

const DATABASE_FILE_NAME = 'app.sqlite';

const LOG_FILE_NAME = 'app-logs.ndjson';

const DEFAULT_RETAINED_BACKUP_COUNT = 10;

const MINIMUM_RETAINED_BACKUP_COUNT = 0;

const MAXIMUM_RETAINED_BACKUP_COUNT = 50;

interface FakeStorage {
	selectedDirectories: string[];
	selectedCounts: number[];
	storage: {
		setBackupDirectory: (directory: string) => void;
		setRetainedBackupCount: (retainedBackupCount: number) => void;
	};
}

const tempDirectories: string[] = [];

// The framework only decides which of these applies, so the tests supply the wording an application would
const directoryMessages: BackupDirectoryMessages = {
	noDirectorySelected: 'No folder selected.',
	createMissingDirectoryMessage: (directory) => {
		return `Missing: ${directory}`;
	},
	createNotADirectoryMessage: (directory) => {
		return `Not a folder: ${directory}`;
	},
	createUnusableDirectoryMessage: (directory) => {
		return `Unusable: ${directory}`;
	}
};

const makeTempDirectory = (): string => {
	const directory = mkdtempSync(path.join(tmpdir(), 'backup-location-'));
	tempDirectories.push(directory);

	return directory;
};

const createRuntimePaths = (rootDirectory: string, isDevelopment = false): RuntimePaths => {
	const databaseDirectory = path.join(rootDirectory, 'storage');

	return {
		isDevelopment,
		rootDirectory,
		configFilePath: path.join(rootDirectory, 'app-config.json'),
		logDirectory: path.join(rootDirectory, 'logs'),
		databaseDirectory,
		databasePath: path.join(databaseDirectory, DATABASE_FILE_NAME),
		defaultBackupDirectory: path.join(rootDirectory, 'backups')
	};
};

const createFakeSettingsStore = (savedSettings: StoredBackupSettings = {}): {
	settingsStore: BackupSettingsStore;
	getSavedSettings: () => StoredBackupSettings;
} => {
	let currentSettings = savedSettings;

	return {
		settingsStore: {
			read: () => {
				return currentSettings;
			},
			write: vi.fn((settings: StoredBackupSettings) => {
				currentSettings = settings;
			})
		},
		getSavedSettings: () => {
			return currentSettings;
		}
	};
};

// The manager takes the count it starts from and the range it holds a choice to, so the tests supply them once
const createTestManager = (options: Omit<Parameters<typeof createBackupLocationManager>[0], 'directoryMessages' | 'defaultRetainedBackupCount' | 'minimumRetainedBackupCount' | 'maximumRetainedBackupCount'>) => {
	return createBackupLocationManager({
		directoryMessages,
		defaultRetainedBackupCount: DEFAULT_RETAINED_BACKUP_COUNT,
		minimumRetainedBackupCount: MINIMUM_RETAINED_BACKUP_COUNT,
		maximumRetainedBackupCount: MAXIMUM_RETAINED_BACKUP_COUNT,
		...options
	});
};

// Starts the process-wide logger on a folder of this test's own, so that what the manager wrote can be read back from the file it wrote it to
const startLogger = (logDirectory: string): void => {
	initializeAppLogger({
		logDirectory,
		fileName: LOG_FILE_NAME,
		maximumFileSizeBytes: 1024 * 1024,
		retainedArchiveCount: 1
	});
};

const readLoggedMessages = (logDirectory: string): string[] => {
	const logFilePath = path.join(logDirectory, LOG_FILE_NAME);

	if(!existsSync(logFilePath)) {
		return [];
	}

	return readFileSync(logFilePath, 'utf8')
		.split('\n')
		.filter((line) => {
			return line.length > 0;
		})
		.map((line) => {
			return (JSON.parse(line) as { message: string }).message;
		});
};

const createFakeStorage = (): FakeStorage => {
	const selectedDirectories: string[] = [];
	const selectedCounts: number[] = [];

	return {
		selectedDirectories,
		selectedCounts,
		storage: {
			setBackupDirectory: vi.fn((directory: string) => {
				selectedDirectories.push(directory);
			}),
			setRetainedBackupCount: vi.fn((retainedBackupCount: number) => {
				selectedCounts.push(retainedBackupCount);
			})
		}
	};
};

describe('BackupLocationManager', () => {
	afterEach(() => {
		resetAppLoggerForTests();

		while(tempDirectories.length > 0) {
			rmSync(tempDirectories.pop()!, { recursive: true, force: true });
		}
	});

	test('starts on the default backup folder and creates it', async() => {
		const rootDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { settingsStore } = createFakeSettingsStore();
		const { selectedDirectories, storage } = createFakeStorage();
		const manager = createTestManager({ runtimePaths, storage, settingsStore });

		const location = await manager.initialize();

		expect(location).toMatchObject({
			directory: runtimePaths.defaultBackupDirectory,
			defaultDirectory: runtimePaths.defaultBackupDirectory,
			databaseDirectory: runtimePaths.databaseDirectory,
			databasePath: runtimePaths.databasePath
		});
		expect(selectedDirectories).toEqual([ runtimePaths.defaultBackupDirectory ]);
		expect(existsSync(runtimePaths.defaultBackupDirectory)).toBe(true);
	});

	test('reuses the saved backup folder without persisting it again', async() => {
		const rootDirectory = makeTempDirectory();
		const savedDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { settingsStore } = createFakeSettingsStore({ directory: savedDirectory });
		const { selectedDirectories, storage } = createFakeStorage();
		const manager = createTestManager({ runtimePaths, storage, settingsStore });

		const location = await manager.initialize();

		expect(location.directory).toBe(savedDirectory);
		expect(selectedDirectories).toEqual([ savedDirectory ]);
		expect(settingsStore.write).not.toHaveBeenCalled();
	});

	// The records live in the local database, so an unreachable backup folder only costs the copies
	test('falls back to the default folder when the saved one cannot be used', async() => {
		const rootDirectory = makeTempDirectory();
		const blockedDirectory = path.join(makeTempDirectory(), 'blocked');
		writeFileSync(blockedDirectory, 'not a folder', 'utf8');
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { settingsStore } = createFakeSettingsStore({ directory: blockedDirectory });
		const { storage } = createFakeStorage();
		const manager = createTestManager({ runtimePaths, storage, settingsStore });

		const location = await manager.initialize();

		expect(location.directory).toBe(runtimePaths.defaultBackupDirectory);
		expect(location.message).toBeTruthy();
	});

	test('ignores the saved folder on a development run', async() => {
		const rootDirectory = makeTempDirectory();
		const savedDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory, true);
		const { settingsStore } = createFakeSettingsStore({ directory: savedDirectory });
		const { selectedDirectories, storage } = createFakeStorage();
		const manager = createTestManager({ runtimePaths, storage, settingsStore });

		const location = await manager.initialize();

		expect(location.directory).toBe(runtimePaths.defaultBackupDirectory);
		expect(location.isDevelopment).toBe(true);
		expect(selectedDirectories).toEqual([ runtimePaths.defaultBackupDirectory ]);
	});

	test('persists a backup folder chosen by the user and asks for a backup covering the change', async() => {
		const rootDirectory = makeTempDirectory();
		const chosenDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { settingsStore, getSavedSettings } = createFakeSettingsStore();
		const { selectedDirectories, storage } = createFakeStorage();
		const onBackupSettingsChanged = vi.fn();
		const manager = createTestManager({ runtimePaths, storage, settingsStore, onBackupSettingsChanged });

		await manager.initialize();
		const result = await manager.setBackupDirectory(chosenDirectory);

		expect(result).toMatchObject({
			ok: true,
			location: {
				directory: chosenDirectory
			}
		});
		expect(getSavedSettings().directory).toBe(chosenDirectory);
		expect(selectedDirectories).toEqual([ runtimePaths.defaultBackupDirectory, chosenDirectory ]);
		expect(onBackupSettingsChanged).toHaveBeenCalledTimes(1);
	});

	test('keeps the current folder when the chosen one cannot be used', async() => {
		const rootDirectory = makeTempDirectory();
		const blockedDirectory = path.join(makeTempDirectory(), 'blocked');
		writeFileSync(blockedDirectory, 'not a folder', 'utf8');
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { settingsStore, getSavedSettings } = createFakeSettingsStore();
		const { storage } = createFakeStorage();
		const manager = createTestManager({ runtimePaths, storage, settingsStore });

		await manager.initialize();
		const result = await manager.setBackupDirectory(blockedDirectory);

		expect(result.ok).toBe(false);
		expect(manager.getLocation().directory).toBe(runtimePaths.defaultBackupDirectory);
		expect(getSavedSettings().directory).toBeUndefined();
	});

	// Every launch applies the folder it already had, and an entry saying so at every startup would push the ones that mean something out of the log
	test('logs nothing when startup applies the folder it already had', async() => {
		const rootDirectory = makeTempDirectory();
		const savedDirectory = makeTempDirectory();
		const logDirectory = makeTempDirectory();
		startLogger(logDirectory);
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { settingsStore } = createFakeSettingsStore({ directory: savedDirectory });
		const { storage } = createFakeStorage();
		const manager = createTestManager({ runtimePaths, storage, settingsStore });

		await manager.initialize();

		expect(readLoggedMessages(logDirectory)).toEqual([]);
	});

	test('logs the folder the user moved the backups to', async() => {
		const rootDirectory = makeTempDirectory();
		const chosenDirectory = makeTempDirectory();
		const logDirectory = makeTempDirectory();
		startLogger(logDirectory);
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { settingsStore } = createFakeSettingsStore();
		const { storage } = createFakeStorage();
		const manager = createTestManager({ runtimePaths, storage, settingsStore });

		await manager.initialize();
		await manager.setBackupDirectory(chosenDirectory);

		expect(readLoggedMessages(logDirectory)).toEqual([ 'Backup folder selected' ]);
	});

	test('logs nothing when the user picks the folder already in use', async() => {
		const rootDirectory = makeTempDirectory();
		const logDirectory = makeTempDirectory();
		startLogger(logDirectory);
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { settingsStore } = createFakeSettingsStore();
		const { storage } = createFakeStorage();
		const manager = createTestManager({ runtimePaths, storage, settingsStore });

		await manager.initialize();
		await manager.setBackupDirectory(runtimePaths.defaultBackupDirectory);

		expect(readLoggedMessages(logDirectory)).toEqual([]);
	});

	test('runs the folder change on the storage chain', async() => {
		const rootDirectory = makeTempDirectory();
		const chosenDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { settingsStore } = createFakeSettingsStore();
		const { storage } = createFakeStorage();
		const trackExclusiveRun = vi.fn();
		const runExclusively = <TResult>(operation: () => Promise<TResult>): Promise<TResult> => {
			trackExclusiveRun();

			return operation();
		};
		const manager = createTestManager({ runtimePaths, storage, settingsStore, runExclusively });

		await manager.initialize();
		await manager.setBackupDirectory(chosenDirectory);

		expect(trackExclusiveRun).toHaveBeenCalledTimes(3);
	});
	test('starts on the default number of copies and hands it to storage', async() => {
		const rootDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { settingsStore } = createFakeSettingsStore();
		const { selectedCounts, storage } = createFakeStorage();
		const manager = createTestManager({ runtimePaths, storage, settingsStore });

		const location = await manager.initialize();

		expect(location.retainedBackupCount).toBe(DEFAULT_RETAINED_BACKUP_COUNT);
		expect(manager.getRetainedBackupCount()).toBe(DEFAULT_RETAINED_BACKUP_COUNT);
		expect(selectedCounts).toEqual([ DEFAULT_RETAINED_BACKUP_COUNT ]);
	});

	test('reuses the saved number of copies without persisting it again', async() => {
		const rootDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { settingsStore } = createFakeSettingsStore({ retainedBackupCount: 3 });
		const { storage } = createFakeStorage();
		const manager = createTestManager({ runtimePaths, storage, settingsStore });

		const location = await manager.initialize();

		expect(location.retainedBackupCount).toBe(3);
		expect(settingsStore.write).not.toHaveBeenCalled();
	});

	// A development run reads and writes its own configuration file, so the count it saved there is its own to reuse
	test('keeps the saved number of copies on a development run', async() => {
		const rootDirectory = makeTempDirectory();
		const savedDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory, true);
		const { settingsStore } = createFakeSettingsStore({ directory: savedDirectory, retainedBackupCount: 2 });
		const { storage } = createFakeStorage();
		const manager = createTestManager({ runtimePaths, storage, settingsStore });

		const location = await manager.initialize();

		expect(location.directory).toBe(runtimePaths.defaultBackupDirectory);
		expect(location.retainedBackupCount).toBe(2);
	});

	// A count reaches the manager from a field the user typed in and from a file anything could have written, so neither is trusted
	test('holds a number of copies outside its range to the nearest one inside it', async() => {
		const rootDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { settingsStore } = createFakeSettingsStore();
		const { storage } = createFakeStorage();
		const manager = createTestManager({ runtimePaths, storage, settingsStore });

		await manager.initialize();

		expect((await manager.setRetainedBackupCount(-4)).location.retainedBackupCount).toBe(MINIMUM_RETAINED_BACKUP_COUNT);
		expect((await manager.setRetainedBackupCount(9000)).location.retainedBackupCount).toBe(MAXIMUM_RETAINED_BACKUP_COUNT);
		expect((await manager.setRetainedBackupCount(4.6)).location.retainedBackupCount).toBe(5);
		expect((await manager.setRetainedBackupCount(Number.NaN)).location.retainedBackupCount).toBe(DEFAULT_RETAINED_BACKUP_COUNT);
	});

	test('persists a number of copies chosen by the user and asks for a backup covering the change', async() => {
		const rootDirectory = makeTempDirectory();
		const logDirectory = makeTempDirectory();
		startLogger(logDirectory);
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { settingsStore, getSavedSettings } = createFakeSettingsStore();
		const { selectedCounts, storage } = createFakeStorage();
		const onBackupSettingsChanged = vi.fn();
		const manager = createTestManager({ runtimePaths, storage, settingsStore, onBackupSettingsChanged });

		await manager.initialize();

		const result = await manager.setRetainedBackupCount(4);

		expect(result.ok).toBe(true);
		expect(getSavedSettings().retainedBackupCount).toBe(4);
		expect(selectedCounts).toEqual([ DEFAULT_RETAINED_BACKUP_COUNT, 4 ]);
		expect(onBackupSettingsChanged).toHaveBeenCalledTimes(1);
		expect(readLoggedMessages(logDirectory)).toEqual([ 'Backup copy count changed' ]);
	});

	// The folder the user chose is not lost by saving the count beside it, and the other way round
	test('saves the folder and the number of copies together', async() => {
		const rootDirectory = makeTempDirectory();
		const chosenDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { settingsStore, getSavedSettings } = createFakeSettingsStore();
		const { storage } = createFakeStorage();
		const manager = createTestManager({ runtimePaths, storage, settingsStore });

		await manager.initialize();
		await manager.setRetainedBackupCount(4);
		await manager.setBackupDirectory(chosenDirectory);

		expect(getSavedSettings()).toEqual({
			directory: chosenDirectory,
			retainedBackupCount: 4
		});
	});
});
