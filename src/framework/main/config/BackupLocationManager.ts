import type { RuntimePaths } from 'src/framework/main/config/RuntimePaths';
import { appLogger } from 'src/framework/main/logging/AppLogger';
import { ensureBackupDirectory, validateBackupDirectory, type BackupDirectoryMessages, type BackupDirectoryValidation } from 'src/framework/main/storage/BackupDirectory';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';
import type { BackupLocation, SetBackupDirectoryResult } from 'src/framework/types/BackupTypes';

interface BackupLocationStorage {
	setBackupDirectory: (directory: string) => void;
}

// Where the selected folder is remembered between runs. Reading and writing only the folder keeps the manager out of the application configuration file shape.
export interface BackupDirectoryStore {
	read: () => string | undefined;
	write: (directory: string) => void;
}

export interface CreateBackupLocationManagerOptions {
	runtimePaths: RuntimePaths;
	storage: BackupLocationStorage;
	directoryStore: BackupDirectoryStore;
	directoryMessages: BackupDirectoryMessages;
	runExclusively?: <TResult>(operation: () => Promise<TResult>) => Promise<TResult>;
	onBackupDirectoryChanged?: () => void;
}

export interface BackupLocationManager {
	initialize: () => Promise<BackupLocation>;
	getLocation: () => BackupLocation;
	setBackupDirectory: (directory: string) => Promise<SetBackupDirectoryResult>;
	setDefaultBackupDirectory: () => Promise<SetBackupDirectoryResult>;

	// Checks a folder without selecting it, so the folder dialog can refuse one in the same words the manager would
	validateDirectory: (directory: string) => BackupDirectoryValidation;
}

interface ApplyBackupDirectoryOptions {
	persist: boolean;
}

// Owns the folder that receives the rotated database backups. Changing it never touches the database itself, which always stays in the local
// database directory, so a folder that turns out to be unusable only costs the backups: the application falls back to the default folder and keeps working.
export const createBackupLocationManager = ({
	runtimePaths,
	storage,
	directoryStore,
	directoryMessages,
	runExclusively = (operation) => {
		return operation();
	},
	onBackupDirectoryChanged
}: CreateBackupLocationManagerOptions): BackupLocationManager => {
	const validateDirectory = (directory: string): BackupDirectoryValidation => {
		return validateBackupDirectory(directory, directoryMessages);
	};

	const createLocation = (directory: string, message?: string): BackupLocation => {
		return {
			directory,
			defaultDirectory: runtimePaths.defaultBackupDirectory,
			databaseDirectory: runtimePaths.databaseDirectory,
			databasePath: runtimePaths.databasePath,
			isDevelopment: runtimePaths.isDevelopment,
			message
		};
	};

	let location = createLocation(runtimePaths.defaultBackupDirectory);

	const createFailure = (message: string): SetBackupDirectoryResult => {
		return {
			ok: false,
			message,
			location
		};
	};

	// Lets a backup that is already being written to the current folder finish before the next one is sent somewhere else
	const applyBackupDirectory = async(
		directory: string,
		{ persist }: ApplyBackupDirectoryOptions
	): Promise<SetBackupDirectoryResult> => {
		try {
			ensureBackupDirectory(directory);
		}
		catch(error) {
			return createFailure(getErrorMessage(error));
		}

		const validation = validateDirectory(directory);

		if(!validation.ok) {
			return createFailure(validation.message);
		}

		const previousDirectory = location.directory;

		await runExclusively(() => {
			storage.setBackupDirectory(directory);

			return Promise.resolve();
		});

		location = createLocation(directory);

		if(persist) {
			directoryStore.write(directory);
		}

		// Only a folder the user actually moved the backups to is worth an entry, and persisting the choice is what tells one apart
		// from the folder startup applies again on every launch. An entry for the latter would say nothing that the configuration
		// the application logs at startup does not already say, while pushing the entries that do out of the rolled log file.
		if(persist && directory !== previousDirectory) {
			appLogger.info('Backup folder selected', {
				type: 'config.backupDirectory',
				previousDirectory,
				directory,
				isDevelopment: runtimePaths.isDevelopment
			});
		}

		// The new folder is empty until something is written to it, so the next backup is made to cover the change itself
		onBackupDirectoryChanged?.();

		return {
			ok: true,
			location
		};
	};

	// Development runs always restart on the development backup folder, ignoring any folder selected during a previous development session
	const initialize = async(): Promise<BackupLocation> => {
		const savedDirectory = runtimePaths.isDevelopment ? undefined : directoryStore.read();
		const result = await applyBackupDirectory(savedDirectory || runtimePaths.defaultBackupDirectory, { persist: false });

		if(result.ok || !savedDirectory) {
			return location;
		}

		// The saved folder may be on a drive that is not available right now: backups fall back to the default folder without any user action
		appLogger.warn('The saved backup folder cannot be used', {
			type: 'config.backupDirectory',
			directory: savedDirectory,
			error: result.message
		});

		const fallbackResult = await applyBackupDirectory(runtimePaths.defaultBackupDirectory, { persist: false });

		location = createLocation(runtimePaths.defaultBackupDirectory, fallbackResult.ok ? result.message : fallbackResult.message);

		return location;
	};

	return {
		initialize,
		getLocation: () => {
			return location;
		},
		setBackupDirectory: (directory: string) => {
			return applyBackupDirectory(directory, { persist: true });
		},
		setDefaultBackupDirectory: () => {
			return applyBackupDirectory(runtimePaths.defaultBackupDirectory, { persist: true });
		},
		validateDirectory
	};
};
