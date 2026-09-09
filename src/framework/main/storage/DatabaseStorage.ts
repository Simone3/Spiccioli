import path from 'node:path';
import { appLogger, type AppLogFields } from 'src/framework/main/logging/AppLogger';
import type { AppDatabase } from 'src/framework/main/storage/AppDatabase';
import { latestBackupExists, readLastArchiveBackupTime, writeArchiveBackup, writeLatestBackup } from 'src/framework/main/storage/DatabaseBackup';
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
	setRetainedBackupCount: (retainedBackupCount: number) => void;

	// Refreshes the copy that is kept up to date, which is the only backup operation that reads the database
	syncLatestBackup: () => Promise<BackupResult>;

	// Adds a dated copy beside it, taken from that copy rather than from the database. Only called when the folder keeps more than
	// the up-to-date copy alone, because a dated copy that is rotated out the moment it is written is worse than none.
	archiveLatestBackup: () => Promise<BackupResult>;

	// When the newest dated copy in the folder was written, read from the folder itself so that it survives a restart and so that a
	// folder that was just selected is immediately due for one
	getLastArchiveTime: () => Promise<Date | undefined>;

	prepareForShutdown: () => Promise<void>;
}

export interface CreateDatabaseStorageOptions<TCommand, TRecord> {
	databaseDirectory: string;
	databaseFileName: string;
	backupDirectory: string;
	backupNaming: BackupFileNaming;

	// How many copies the folder keeps, counting the up-to-date one. It is a user setting, so this is only what it starts the run at.
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
	retainedBackupCount: initialRetainedBackupCount,
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
	let retainedBackupCount = initialRetainedBackupCount;
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
	const reportBackupFailure = (error: unknown, message: string, fields: AppLogFields): BackupResult => {
		const failureMessage = getErrorMessage(error);

		backupStatus = {
			...backupStatus,
			state: 'failed',
			directory: backupDirectory,
			message: failureMessage
		};

		appLogger.error(message, {
			...fields,
			backupDirectory,
			error: failureMessage
		});

		return {
			ok: false,
			message: failureMessage,
			status: backupStatus
		};
	};

	const syncLatestBackup = async(): Promise<BackupResult> => {
		try {
			const backupPath = await writeLatestBackup({
				database: getDatabase(),
				backupDirectory,
				temporaryDirectory: databaseDirectory,
				naming: backupNaming
			});

			backupStatus = {
				...backupStatus,
				state: 'ok',
				directory: backupDirectory,
				latestCopyAt: getCurrentDate().toISOString(),
				latestCopyPath: backupPath,
				message: undefined
			};

			appLogger.info('The up-to-date database backup copy was written', {
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
			return reportBackupFailure(error, 'Could not write the up-to-date database backup copy', { type: 'storage.backup' });
		}
	};

	// The dated copy is taken from the up-to-date one, so a folder that has not received that one yet — one just selected, most of
	// all — gets it first rather than being left without a dated copy until the next task change
	const archiveLatestBackup = async(): Promise<BackupResult> => {
		try {
			if(!await latestBackupExists(backupNaming, backupDirectory)) {
				await writeLatestBackup({
					database: getDatabase(),
					backupDirectory,
					temporaryDirectory: databaseDirectory,
					naming: backupNaming
				});
			}

			const backupPath = await writeArchiveBackup({
				backupDirectory,
				naming: backupNaming,

				// The count the user chooses covers the up-to-date copy as well, and that one is never rotated out
				retainedArchiveCount: Math.max(0, retainedBackupCount - 1),

				now
			});

			backupStatus = {
				...backupStatus,
				state: 'ok',
				directory: backupDirectory,
				lastArchiveAt: getCurrentDate().toISOString(),
				lastArchivePath: backupPath,
				message: undefined
			};

			appLogger.info('A dated database backup copy was written', {
				type: 'storage.backup',
				backupPath,
				retainedBackupCount
			});

			return {
				ok: true,
				backupPath,
				status: backupStatus
			};
		}
		catch(error) {
			return reportBackupFailure(error, 'Could not write a dated database backup copy', { type: 'storage.backup' });
		}
	};

	const getLastArchiveTime = (): Promise<Date | undefined> => {
		return readLastArchiveBackupTime(backupNaming, backupDirectory);
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
		setRetainedBackupCount: (nextRetainedBackupCount: number) => {
			retainedBackupCount = nextRetainedBackupCount;
		},
		syncLatestBackup,
		archiveLatestBackup,
		getLastArchiveTime,
		prepareForShutdown
	};
};
