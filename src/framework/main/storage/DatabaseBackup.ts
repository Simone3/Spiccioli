import { copyFile, mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { AppDatabase } from 'src/framework/main/storage/AppDatabase';
import type { BackupFileNaming } from 'src/framework/types/BackupTypes';

export interface CreateDatabaseBackupOptions {
	database: AppDatabase;
	backupDirectory: string;
	temporaryDirectory: string;
	naming: BackupFileNaming;
	retainedBackupCount: number;
	now?: () => Date;
}

// Colons and dots cannot be used on every platform, and the remaining format still sorts the backups chronologically by name
export const createBackupFileName = (naming: BackupFileNaming, createdAt: Date): string => {
	const timestamp = createdAt.toISOString().replace(/[:.]/g, '-');

	return `${naming.filePrefix}${timestamp}${naming.fileExtension}`;
};

export const isBackupFileName = (naming: BackupFileNaming, fileName: string): boolean => {
	return fileName.startsWith(naming.filePrefix) && fileName.endsWith(naming.fileExtension);
};

const isPartialBackupFileName = (naming: BackupFileNaming, fileName: string): boolean => {
	return fileName.startsWith(naming.filePrefix) && fileName.endsWith(naming.partialFileExtension);
};

const readBackupDirectoryFileNames = async(backupDirectory: string): Promise<string[]> => {
	try {
		return await readdir(backupDirectory);
	}
	catch {
		return [];
	}
};

export const readBackupFileNames = async(naming: BackupFileNaming, backupDirectory: string): Promise<string[]> => {
	return (await readBackupDirectoryFileNames(backupDirectory)).filter((fileName) => {
		return isBackupFileName(naming, fileName);
	}).sort();
};

// Shutdown abandons a backup that is taking too long, so the half-copied file it may leave behind is cleared by the next run
const removePartialBackupFiles = async(naming: BackupFileNaming, backupDirectory: string): Promise<void> => {
	const partialFileNames = (await readBackupDirectoryFileNames(backupDirectory)).filter((fileName) => {
		return isPartialBackupFileName(naming, fileName);
	});

	await Promise.all(partialFileNames.map((fileName) => {
		return rm(path.join(backupDirectory, fileName), { force: true });
	}));
};

// Only the files the application itself wrote are removed, so anything else the user keeps in the backup folder is left alone
const pruneBackupFiles = async(naming: BackupFileNaming, backupDirectory: string, retainedBackupCount: number): Promise<void> => {
	const backupFileNames = await readBackupFileNames(naming, backupDirectory);
	const excessCount = backupFileNames.length - retainedBackupCount;

	if(excessCount <= 0) {
		return;
	}

	await Promise.all(backupFileNames.slice(0, excessCount).map((fileName) => {
		return rm(path.join(backupDirectory, fileName), { force: true });
	}));
};

// Writes one rotated backup copy of the live database into the backup folder. The snapshot is built on the local disk first and only then
// published, so the backup folder never holds a database that is still being written: a synchronization client watching that folder can
// therefore only ever see complete files.
export const createDatabaseBackup = async({ database, backupDirectory, temporaryDirectory, naming, retainedBackupCount, now = () => {
	return new Date();
} }: CreateDatabaseBackupOptions): Promise<string> => {
	const temporaryPath = path.join(temporaryDirectory, naming.temporaryFileName);
	const backupPath = path.join(backupDirectory, createBackupFileName(naming, now()));
	const partialBackupPath = `${backupPath}${naming.partialFileExtension}`;

	await mkdir(temporaryDirectory, { recursive: true });
	await mkdir(backupDirectory, { recursive: true });
	await removePartialBackupFiles(naming, backupDirectory);

	// VACUUM INTO refuses to write over an existing file, so a snapshot left behind by an interrupted backup is cleared first
	await rm(temporaryPath, { force: true });

	try {
		// Only this step touches the database, and it stays on the local disk: copying into a possibly slow backup folder happens afterwards
		database.vacuumInto(temporaryPath);

		await copyFile(temporaryPath, partialBackupPath);
		await rename(partialBackupPath, backupPath);
	}
	catch(error) {
		await rm(partialBackupPath, { force: true });

		throw error;
	}
	finally {
		await rm(temporaryPath, { force: true });
	}

	await pruneBackupFiles(naming, backupDirectory, retainedBackupCount);

	return backupPath;
};
