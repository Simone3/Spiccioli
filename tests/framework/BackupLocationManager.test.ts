import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBackupLocationManager, type BackupDirectoryStore } from 'src/framework/main/config/BackupLocationManager';
import type { RuntimePaths } from 'src/framework/main/config/RuntimePaths';
import { initializeAppLogger, resetAppLoggerForTests } from 'src/framework/main/logging/AppLogger';
import type { BackupDirectoryMessages } from 'src/framework/main/storage/BackupDirectory';

const DATABASE_FILE_NAME = 'app.sqlite';

const LOG_FILE_NAME = 'app-logs.ndjson';

interface FakeStorage {
	selectedDirectories: string[];
	storage: {
		setBackupDirectory: (directory: string) => void;
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

const createFakeDirectoryStore = (savedDirectory?: string): {
	directoryStore: BackupDirectoryStore;
	getSavedDirectory: () => string | undefined;
} => {
	let currentDirectory = savedDirectory;

	return {
		directoryStore: {
			read: () => {
				return currentDirectory;
			},
			write: vi.fn((directory: string) => {
				currentDirectory = directory;
			})
		},
		getSavedDirectory: () => {
			return currentDirectory;
		}
	};
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

	return {
		selectedDirectories,
		storage: {
			setBackupDirectory: vi.fn((directory: string) => {
				selectedDirectories.push(directory);
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
		const { directoryStore } = createFakeDirectoryStore();
		const { selectedDirectories, storage } = createFakeStorage();
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore, directoryMessages });

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
		const { directoryStore } = createFakeDirectoryStore(savedDirectory);
		const { selectedDirectories, storage } = createFakeStorage();
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore, directoryMessages });

		const location = await manager.initialize();

		expect(location.directory).toBe(savedDirectory);
		expect(selectedDirectories).toEqual([ savedDirectory ]);
		expect(directoryStore.write).not.toHaveBeenCalled();
	});

	// The records live in the local database, so an unreachable backup folder only costs the copies
	test('falls back to the default folder when the saved one cannot be used', async() => {
		const rootDirectory = makeTempDirectory();
		const blockedDirectory = path.join(makeTempDirectory(), 'blocked');
		writeFileSync(blockedDirectory, 'not a folder', 'utf8');
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { directoryStore } = createFakeDirectoryStore(blockedDirectory);
		const { storage } = createFakeStorage();
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore, directoryMessages });

		const location = await manager.initialize();

		expect(location.directory).toBe(runtimePaths.defaultBackupDirectory);
		expect(location.message).toBeTruthy();
	});

	test('ignores the saved folder on a development run', async() => {
		const rootDirectory = makeTempDirectory();
		const savedDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory, true);
		const { directoryStore } = createFakeDirectoryStore(savedDirectory);
		const { selectedDirectories, storage } = createFakeStorage();
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore, directoryMessages });

		const location = await manager.initialize();

		expect(location.directory).toBe(runtimePaths.defaultBackupDirectory);
		expect(location.isDevelopment).toBe(true);
		expect(selectedDirectories).toEqual([ runtimePaths.defaultBackupDirectory ]);
	});

	test('persists a backup folder chosen by the user and asks for a backup covering the change', async() => {
		const rootDirectory = makeTempDirectory();
		const chosenDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { directoryStore, getSavedDirectory } = createFakeDirectoryStore();
		const { selectedDirectories, storage } = createFakeStorage();
		const onBackupDirectoryChanged = vi.fn();
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore, directoryMessages, onBackupDirectoryChanged });

		await manager.initialize();
		const result = await manager.setBackupDirectory(chosenDirectory);

		expect(result).toMatchObject({
			ok: true,
			location: {
				directory: chosenDirectory
			}
		});
		expect(getSavedDirectory()).toBe(chosenDirectory);
		expect(selectedDirectories).toEqual([ runtimePaths.defaultBackupDirectory, chosenDirectory ]);
		expect(onBackupDirectoryChanged).toHaveBeenCalledTimes(2);
	});

	test('keeps the current folder when the chosen one cannot be used', async() => {
		const rootDirectory = makeTempDirectory();
		const blockedDirectory = path.join(makeTempDirectory(), 'blocked');
		writeFileSync(blockedDirectory, 'not a folder', 'utf8');
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { directoryStore, getSavedDirectory } = createFakeDirectoryStore();
		const { storage } = createFakeStorage();
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore, directoryMessages });

		await manager.initialize();
		const result = await manager.setBackupDirectory(blockedDirectory);

		expect(result.ok).toBe(false);
		expect(manager.getLocation().directory).toBe(runtimePaths.defaultBackupDirectory);
		expect(getSavedDirectory()).toBeUndefined();
	});

	// Every launch applies the folder it already had, and an entry saying so at every startup would push the ones that mean something out of the log
	test('logs nothing when startup applies the folder it already had', async() => {
		const rootDirectory = makeTempDirectory();
		const savedDirectory = makeTempDirectory();
		const logDirectory = makeTempDirectory();
		startLogger(logDirectory);
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { directoryStore } = createFakeDirectoryStore(savedDirectory);
		const { storage } = createFakeStorage();
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore, directoryMessages });

		await manager.initialize();

		expect(readLoggedMessages(logDirectory)).toEqual([]);
	});

	test('logs the folder the user moved the backups to', async() => {
		const rootDirectory = makeTempDirectory();
		const chosenDirectory = makeTempDirectory();
		const logDirectory = makeTempDirectory();
		startLogger(logDirectory);
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { directoryStore } = createFakeDirectoryStore();
		const { storage } = createFakeStorage();
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore, directoryMessages });

		await manager.initialize();
		await manager.setBackupDirectory(chosenDirectory);

		expect(readLoggedMessages(logDirectory)).toEqual([ 'Backup folder selected' ]);
	});

	test('logs nothing when the user picks the folder already in use', async() => {
		const rootDirectory = makeTempDirectory();
		const logDirectory = makeTempDirectory();
		startLogger(logDirectory);
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { directoryStore } = createFakeDirectoryStore();
		const { storage } = createFakeStorage();
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore, directoryMessages });

		await manager.initialize();
		await manager.setBackupDirectory(runtimePaths.defaultBackupDirectory);

		expect(readLoggedMessages(logDirectory)).toEqual([]);
	});

	test('runs the folder change on the storage chain', async() => {
		const rootDirectory = makeTempDirectory();
		const chosenDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { directoryStore } = createFakeDirectoryStore();
		const { storage } = createFakeStorage();
		const trackExclusiveRun = vi.fn();
		const runExclusively = <TResult>(operation: () => Promise<TResult>): Promise<TResult> => {
			trackExclusiveRun();

			return operation();
		};
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore, directoryMessages, runExclusively });

		await manager.initialize();
		await manager.setBackupDirectory(chosenDirectory);

		expect(trackExclusiveRun).toHaveBeenCalledTimes(2);
	});
});
