import path from 'node:path';
import { appLogger, type AppLogFields } from 'src/framework/main/logging/AppLogger';
import type { AppDatabase } from 'src/framework/main/storage/AppDatabase';
import { createDatabaseBackup } from 'src/framework/main/storage/DatabaseBackup';
import { isInvalidChangeError } from 'src/framework/main/storage/InvalidChangeError';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';
import type { BackupFileNaming } from 'src/framework/types/BackupTypes';
import type { BackupResult, BackupStatus, LoadRecordsResult, OperationalLogEntry, OperationalLogWriteResult, StorageCommandResult, StorageDatabaseStatus, StorageFailure, StorageStatus } from 'src/framework/types/StorageTypes';

// Reported to the user when a command arrives after shutdown closed the database, so an application can say it in its own words
export const DEFAULT_STORAGE_CLOSED_MESSAGE = 'Storage is closed.';

export interface DatabaseStorage<TCommand, TRecord> {
	loadRecords: () => Promise<LoadRecordsResult<TRecord>>;
	executeCommand: (command: TCommand) => Promise<StorageCommandResult>;
	writeOperationalLogLine: (entry: OperationalLogEntry) => Promise<OperationalLogWriteResult>;
	getStorageStatus: () => Promise<StorageStatus>;
	getDatabaseDirectory: () => string;
	getBackupDirectory: () => string;
	setBackupDirectory: (backupDirectory: string) => void;
	createBackup: () => Promise<BackupResult>;
	prepareForShutdown: () => Promise<void>;
}

export interface CreateDatabaseStorageOptions<TCommand, TRecord> {
	databaseDirectory: string;
	databaseFileName: string;
	backupDirectory: string;
	backupNaming: BackupFileNaming;
	retainedBackupCount: number;

	// Opens the database this storage owns. It is called lazily, on the first operation that needs it, and never again once shutdown closed it.
	openDatabase: () => AppDatabase;
	readRecords: (database: AppDatabase) => TRecord[];
	executeCommand: (database: AppDatabase, command: TCommand) => void;

	// The fields written to the operational log when a renderer command arrives, so an application can log its own command shape
	describeCommand?: (command: TCommand) => AppLogFields;

	// Reported to the user when a command arrives after the database was closed
	storageClosedMessage?: string;
	now?: () => Date;
}

// Owns the one database the application reads and writes. It always lives in the local database directory: the backup directory only receives rotated
// copies, so it can never become the source of truth.
export const createDatabaseStorage = <TCommand, TRecord>({
	databaseDirectory,
	databaseFileName,
	backupDirectory: initialBackupDirectory,
	backupNaming,
	retainedBackupCount,
	openDatabase,
	readRecords,
	executeCommand,
	describeCommand = (command) => {
		return {
			type: 'renderer.command',
			command
		};
	},
	storageClosedMessage = DEFAULT_STORAGE_CLOSED_MESSAGE,
	now
}: CreateDatabaseStorageOptions<TCommand, TRecord>): DatabaseStorage<TCommand, TRecord> => {
	let database: AppDatabase | undefined;
	let isClosed = false;
	let backupDirectory = initialBackupDirectory;
	let backupStatus: BackupStatus = {
		state: 'idle',
		directory: initialBackupDirectory
	};

	const getCurrentDate = (): Date => {
		return now ? now() : new Date();
	};

	const getDatabase = (): AppDatabase => {
		// Shutdown closes the connection on purpose, right before the process goes away. Opening it again to answer a command that arrived
		// late, or to report a status, would leave behind a database nobody closes a second time and a write-ahead log that is never
		// checkpointed, so storage stays closed instead and says so.
		if(isClosed) {
			throw new Error(storageClosedMessage);
		}

		if(!database) {
			database = openDatabase();
		}

		return database;
	};

	const createStatus = (databaseStatus: StorageDatabaseStatus = { state: 'healthy' }): StorageStatus => {
		return {
			database: databaseStatus,
			storageDirectory: databaseDirectory,
			databasePath: path.join(databaseDirectory, databaseFileName),
			backup: backupStatus
		};
	};

	const createDatabaseFailure = (error: unknown): StorageFailure => {
		const message = getErrorMessage(error);

		return {
			ok: false,
			reason: 'database-error',
			message,
			status: createStatus({
				state: 'unavailable',
				message
			})
		};
	};

	const createInvalidCommandFailure = (error: unknown): StorageFailure => {
		return {
			ok: false,
			reason: 'invalid-command',
			message: getErrorMessage(error),
			status: createStatus()
		};
	};

	const loadRecords = (): Promise<LoadRecordsResult<TRecord>> => {
		try {
			return Promise.resolve({
				ok: true,
				records: readRecords(getDatabase()),
				status: createStatus()
			});
		}
		catch(error) {
			return Promise.resolve(createDatabaseFailure(error));
		}
	};

	const runCommand = (command: TCommand): Promise<StorageCommandResult> => {
		appLogger.info('Renderer storage command received', describeCommand(command));

		try {
			executeCommand(getDatabase(), command);

			return Promise.resolve({
				ok: true,
				status: createStatus()
			});
		}
		catch(error) {
			if(isInvalidChangeError(error)) {
				return Promise.resolve(createInvalidCommandFailure(error));
			}

			return Promise.resolve(createDatabaseFailure(error));
		}
	};

	const writeOperationalLogLine = (entry: OperationalLogEntry): Promise<OperationalLogWriteResult> => {
		const { message, ...fields } = entry;
		appLogger.info(message, fields);

		return Promise.resolve({
			ok: true,
			status: createStatus()
		});
	};

	// A failed backup is reported without touching the database status: the records are already saved in the local database either way
	const createBackup = async(): Promise<BackupResult> => {
		try {
			const backupPath = await createDatabaseBackup({
				database: getDatabase(),
				backupDirectory,
				temporaryDirectory: databaseDirectory,
				naming: backupNaming,
				retainedBackupCount,
				now
			});

			backupStatus = {
				state: 'ok',
				directory: backupDirectory,
				lastBackupAt: getCurrentDate().toISOString(),
				lastBackupPath: backupPath
			};

			appLogger.info('Database backup written', {
				type: 'storage.backup',
				backupPath
			});

			return {
				ok: true,
				backupPath,
				status: backupStatus
			};
		}
		catch(error) {
			const message = getErrorMessage(error);

			backupStatus = {
				state: 'failed',
				directory: backupDirectory,
				lastBackupAt: backupStatus.lastBackupAt,
				lastBackupPath: backupStatus.lastBackupPath,
				message
			};

			appLogger.error('Could not write the database backup', {
				type: 'storage.backup',
				backupDirectory,
				error: message
			});

			return {
				ok: false,
				message,
				status: backupStatus
			};
		}
	};

	// The previous folder keeps the copies it already received, and the status starts over because nothing was written to the new one yet
	const setBackupDirectory = (nextBackupDirectory: string): void => {
		backupDirectory = nextBackupDirectory;
		backupStatus = {
			state: 'idle',
			directory: nextBackupDirectory
		};
	};

	const prepareForShutdown = (): Promise<void> => {
		const databaseToClose = database;
		isClosed = true;
		database = undefined;
		databaseToClose?.close();

		return Promise.resolve();
	};

	return {
		loadRecords,
		executeCommand: runCommand,
		writeOperationalLogLine,
		getStorageStatus: () => {
			try {
				getDatabase();

				return Promise.resolve(createStatus());
			}
			catch(error) {
				return Promise.resolve(createDatabaseFailure(error).status);
			}
		},
		getDatabaseDirectory: () => {
			return databaseDirectory;
		},
		getBackupDirectory: () => {
			return backupDirectory;
		},
		setBackupDirectory,
		createBackup,
		prepareForShutdown
	};
};
