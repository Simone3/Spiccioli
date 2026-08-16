/**
 * The contract for the folder that receives rotated database backups.
 * The database itself never moves, so everything here only ever decides where the copies are written.
 */

export interface BackupLocation {
	directory: string;
	defaultDirectory: string;
	databaseDirectory: string;
	databasePath: string;
	isDevelopment: boolean;

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

export type SetBackupDirectoryResult = {
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
	setBackupDirectory: (directory: string) => Promise<SetBackupDirectoryResult>;
	setDefaultBackupDirectory: () => Promise<SetBackupDirectoryResult>;
}

// How the rotated backup copies are named, so that the framework can recognize the files it wrote and leave everything else in the folder alone
export interface BackupFileNaming {
	filePrefix: string;
	fileExtension: string;
	partialFileExtension: string;
	temporaryFileName: string;
}
