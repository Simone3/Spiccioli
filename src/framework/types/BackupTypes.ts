/**
 * The contract for the folder that receives the database backup copies, and for how many of them it keeps.
 * The database itself never moves, so everything here only ever decides where the copies are written and how far back they go.
 */

export interface BackupLocation {
	directory: string;
	defaultDirectory: string;
	databaseDirectory: string;
	databasePath: string;
	isDevelopment: boolean;

	// How many copies the folder keeps, counting the one that is kept up to date: 0 writes nothing, 1 writes only that one
	retainedBackupCount: number;

	// Set when the configured folder could not be used and the application fell back to the default one
	message?: string;
}

export type ChooseBackupDirectoryResult = {
	ok: true;
	directory: string;
} | {
	ok: false;
	reason: 'cancelled' | 'invalid-directory';
	message?: string;
};

// The answer to any change of the backup settings, which always reports the settings as they now stand: a refused change leaves
// the previous ones in place, and the caller shows what is actually in use either way
export type BackupSettingsResult = {
	ok: true;
	location: BackupLocation;
} | {
	ok: false;
	message: string;
	location: BackupLocation;
};

export interface BackupLocationApi {
	getBackupLocation: () => Promise<BackupLocation>;
	chooseBackupDirectory: () => Promise<ChooseBackupDirectoryResult>;
	setBackupDirectory: (directory: string) => Promise<BackupSettingsResult>;
	setDefaultBackupDirectory: () => Promise<BackupSettingsResult>;
	setRetainedBackupCount: (retainedBackupCount: number) => Promise<BackupSettingsResult>;
}

// How the backup copies are named, so that the framework can recognize the files it wrote and leave everything else in the folder alone
export interface BackupFileNaming {
	filePrefix: string;
	fileExtension: string;
	partialFileExtension: string;
	temporaryFileName: string;

	// The copy that is overwritten in place. It shares the folder with the dated copies, so it must not be a name that carries a
	// timestamp between the prefix and the extension: that is the only thing telling a copy the rotation owns from this one.
	latestFileName: string;
}
