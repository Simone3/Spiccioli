import type { RuntimePaths } from 'src/framework/main/config/RuntimePaths';
import { appLogger } from 'src/framework/main/logging/AppLogger';
import { ensureBackupDirectory, validateBackupDirectory, type BackupDirectoryMessages, type BackupDirectoryValidation } from 'src/framework/main/storage/BackupDirectory';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';
import type { BackupLocation, BackupSettingsResult } from 'src/framework/types/BackupTypes';

interface BackupLocationStorage {
	setBackupDirectory: (directory: string) => void;
	setRetainedBackupCount: (retainedBackupCount: number) => void;
}

// What is remembered between runs. Both settings are written together, so a store that keeps them beside other preferences has to
// merge rather than replace: writing one of them must never be what loses the other.
export interface StoredBackupSettings {
	directory?: string;
	retainedBackupCount?: number;
}

export interface BackupSettingsStore {
	read: () => StoredBackupSettings;
	write: (settings: StoredBackupSettings) => void;
}

export interface CreateBackupLocationManagerOptions {
	runtimePaths: RuntimePaths;
	storage: BackupLocationStorage;
	settingsStore: BackupSettingsStore;
	directoryMessages: BackupDirectoryMessages;

	// How many copies the folder keeps when the user has never chosen, and the range a choice is held to
	defaultRetainedBackupCount: number;
	minimumRetainedBackupCount: number;
	maximumRetainedBackupCount: number;

	runExclusively?: <TResult>(operation: () => Promise<TResult>) => Promise<TResult>;
	onBackupSettingsChanged?: () => void;
}

export interface BackupLocationManager {
	initialize: () => Promise<BackupLocation>;
	getLocation: () => BackupLocation;
	getRetainedBackupCount: () => number;
	setBackupDirectory: (directory: string) => Promise<BackupSettingsResult>;
	setDefaultBackupDirectory: () => Promise<BackupSettingsResult>;
	setRetainedBackupCount: (retainedBackupCount: number) => Promise<BackupSettingsResult>;

	// Checks a folder without selecting it, so the folder dialog can refuse one in the same words the manager would
	validateDirectory: (directory: string) => BackupDirectoryValidation;
}

interface ApplyBackupSettingOptions {

	// Whether this is a change the user made, which is what is saved, logged and worth a fresh backup. Startup applies the settings
	// it already had, and treating that as a change would have every launch write copies of a database nobody has touched.
	persist: boolean;
}

// Owns where the database backup copies are written and how many of them are kept. Changing either never touches the database itself,
// which always stays in the local database directory, so a folder that turns out to be unusable only costs the backups: the application
// falls back to the default folder and keeps working.
export const createBackupLocationManager = ({
	runtimePaths,
	storage,
	settingsStore,
	directoryMessages,
	defaultRetainedBackupCount,
	minimumRetainedBackupCount,
	maximumRetainedBackupCount,
	runExclusively = (operation) => {
		return operation();
	},
	onBackupSettingsChanged
}: CreateBackupLocationManagerOptions): BackupLocationManager => {
	const validateDirectory = (directory: string): BackupDirectoryValidation => {
		return validateBackupDirectory(directory, directoryMessages);
	};

	// A count is a number the user typed and a number a configuration file held, so neither is trusted: anything outside the range,
	// and anything that is not a whole number at all, becomes the nearest count that is rather than a refusal the user has to read
	const holdToRange = (retainedBackupCount: number): number => {
		if(!Number.isFinite(retainedBackupCount)) {
			return defaultRetainedBackupCount;
		}

		return Math.min(maximumRetainedBackupCount, Math.max(minimumRetainedBackupCount, Math.round(retainedBackupCount)));
	};

	let directory = runtimePaths.defaultBackupDirectory;
	let retainedBackupCount = holdToRange(defaultRetainedBackupCount);
	let message: string | undefined;

	const getLocation = (): BackupLocation => {
		return {
			directory,
			defaultDirectory: runtimePaths.defaultBackupDirectory,
			databaseDirectory: runtimePaths.databaseDirectory,
			databasePath: runtimePaths.databasePath,
			isDevelopment: runtimePaths.isDevelopment,
			retainedBackupCount,
			message
		};
	};

	const persistSettings = (): void => {
		settingsStore.write({
			directory,
			retainedBackupCount
		});
	};

	const createFailure = (failureMessage: string): BackupSettingsResult => {
		return {
			ok: false,
			message: failureMessage,
			location: getLocation()
		};
	};

	// Lets a backup that is already being written to the current folder finish before the next one is sent somewhere else
	const applyBackupDirectory = async(
		nextDirectory: string,
		{ persist }: ApplyBackupSettingOptions
	): Promise<BackupSettingsResult> => {
		try {
			ensureBackupDirectory(nextDirectory);
		}
		catch(error) {
			return createFailure(getErrorMessage(error));
		}

		const validation = validateDirectory(nextDirectory);

		if(!validation.ok) {
			return createFailure(validation.message);
		}

		const previousDirectory = directory;

		await runExclusively(() => {
			storage.setBackupDirectory(nextDirectory);

			return Promise.resolve();
		});

		directory = nextDirectory;
		message = undefined;

		if(persist) {
			persistSettings();
		}

		// Only a folder the user actually moved the backups to is worth an entry, and persisting the choice is what tells one apart
		// from the folder startup applies again on every launch. An entry for the latter would say nothing that the configuration
		// the application logs at startup does not already say, while pushing the entries that do out of the rolled log file.
		if(persist && nextDirectory !== previousDirectory) {
			appLogger.info('Backup folder selected', {
				type: 'config.backupDirectory',
				previousDirectory,
				directory: nextDirectory,
				isDevelopment: runtimePaths.isDevelopment
			});
		}

		// A folder the user just chose is empty until something is written to it, so the next backup is made to cover the change itself.
		// Startup is not such a change: it applies the folder it already had, and treating that as one would have every launch write
		// copies of a database nobody has touched.
		if(persist) {
			onBackupSettingsChanged?.();
		}

		return {
			ok: true,
			location: getLocation()
		};
	};

	// Nothing already in the folder is removed when the count is lowered: the copies come down to the new number as the next dated
	// ones rotate them out, and a count of zero, which stops the copies altogether, therefore removes nothing at all
	const applyRetainedBackupCount = async(
		nextRetainedBackupCount: number,
		{ persist }: ApplyBackupSettingOptions
	): Promise<BackupSettingsResult> => {
		const previousRetainedBackupCount = retainedBackupCount;
		const heldCount = holdToRange(nextRetainedBackupCount);

		await runExclusively(() => {
			storage.setRetainedBackupCount(heldCount);

			return Promise.resolve();
		});

		retainedBackupCount = heldCount;

		if(persist) {
			persistSettings();
		}

		if(persist && heldCount !== previousRetainedBackupCount) {
			appLogger.info('Backup copy count changed', {
				type: 'config.backupRetention',
				previousRetainedBackupCount,
				retainedBackupCount: heldCount
			});
		}

		// A count raised from zero leaves a folder with nothing in it, so the next backup is made to cover the change itself. As with
		// the folder, the count startup applies again is not a change.
		if(persist) {
			onBackupSettingsChanged?.();
		}

		return {
			ok: true,
			location: getLocation()
		};
	};

	// Development runs always restart on the development backup folder, ignoring any folder selected during a previous development
	// session. The count is honoured either way: a development run reads and writes its own configuration file.
	const initialize = async(): Promise<BackupLocation> => {
		const storedSettings = settingsStore.read();
		const savedDirectory = runtimePaths.isDevelopment ? undefined : storedSettings.directory;

		await applyRetainedBackupCount(storedSettings.retainedBackupCount ?? defaultRetainedBackupCount, { persist: false });

		const result = await applyBackupDirectory(savedDirectory || runtimePaths.defaultBackupDirectory, { persist: false });

		if(result.ok || !savedDirectory) {
			return getLocation();
		}

		// The saved folder may be on a drive that is not available right now: backups fall back to the default folder without any user action
		appLogger.warn('The saved backup folder cannot be used', {
			type: 'config.backupDirectory',
			directory: savedDirectory,
			error: result.message
		});

		const fallbackResult = await applyBackupDirectory(runtimePaths.defaultBackupDirectory, { persist: false });

		message = fallbackResult.ok ? result.message : fallbackResult.message;

		return getLocation();
	};

	return {
		initialize,
		getLocation,
		getRetainedBackupCount: () => {
			return retainedBackupCount;
		},
		setBackupDirectory: (nextDirectory: string) => {
			return applyBackupDirectory(nextDirectory, { persist: true });
		},
		setDefaultBackupDirectory: () => {
			return applyBackupDirectory(runtimePaths.defaultBackupDirectory, { persist: true });
		},
		setRetainedBackupCount: (nextRetainedBackupCount: number) => {
			return applyRetainedBackupCount(nextRetainedBackupCount, { persist: true });
		},
		validateDirectory
	};
};
