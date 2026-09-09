import { copyFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { AppDatabase } from 'src/framework/main/storage/AppDatabase';
import type { BackupFileNaming } from 'src/framework/types/BackupTypes';

export interface WriteLatestBackupOptions {
	database: AppDatabase;
	backupDirectory: string;
	temporaryDirectory: string;
	naming: BackupFileNaming;
}

export interface WriteArchiveBackupOptions {
	backupDirectory: string;
	naming: BackupFileNaming;

	// How many dated copies the folder keeps once this one is in it. It must be at least one: a folder that keeps none never writes
	// a dated copy in the first place, and asking for one here would write it and immediately rotate it out.
	retainedArchiveCount: number;

	now?: () => Date;
}

// What a dated copy carries between the prefix and the extension, which is the ISO instant with the colons and dots a file name
// cannot hold on every platform replaced. It is matched rather than merely stripped, because it is the only thing separating a copy
// the rotation owns from the copy that is kept up to date beside it, and from whatever else the folder happens to hold.
const ARCHIVE_TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/;

export const getLatestBackupPath = (naming: BackupFileNaming, backupDirectory: string): string => {
	return path.join(backupDirectory, naming.latestFileName);
};

// The remaining format still sorts the dated copies chronologically by name, which is what makes "oldest" a sort rather than a stat
// of every file in the folder
export const createArchiveBackupFileName = (naming: BackupFileNaming, createdAt: Date): string => {
	const timestamp = createdAt.toISOString().replace(/[:.]/g, '-');

	return `${naming.filePrefix}${timestamp}${naming.fileExtension}`;
};

/**
 * Reads back the instant a dated copy was written from its own name.
 * @param naming How the copies are named.
 * @param fileName File to read the instant from.
 * @returns When the copy was written, or undefined when the file is not one of the dated copies.
 */
export const readArchiveBackupTime = (naming: BackupFileNaming, fileName: string): Date | undefined => {
	if(!fileName.startsWith(naming.filePrefix) || !fileName.endsWith(naming.fileExtension)) {
		return undefined;
	}

	const timestamp = fileName.slice(naming.filePrefix.length, fileName.length - naming.fileExtension.length);
	const match = ARCHIVE_TIMESTAMP_PATTERN.exec(timestamp);

	if(!match) {
		return undefined;
	}

	const [ , date, hours, minutes, seconds, milliseconds ] = match;
	const writtenAt = new Date(`${date}T${hours}:${minutes}:${seconds}.${milliseconds}Z`);

	return Number.isNaN(writtenAt.getTime()) ? undefined : writtenAt;
};

export const isArchiveBackupFileName = (naming: BackupFileNaming, fileName: string): boolean => {
	return readArchiveBackupTime(naming, fileName) !== undefined;
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

export const readArchiveBackupFileNames = async(naming: BackupFileNaming, backupDirectory: string): Promise<string[]> => {
	return (await readBackupDirectoryFileNames(backupDirectory)).filter((fileName) => {
		return isArchiveBackupFileName(naming, fileName);
	}).sort();
};

/**
 * Reads when the newest dated copy in the folder was written.
 * @param naming How the copies are named.
 * @param backupDirectory Folder the copies live in.
 * @returns When the newest dated copy was written, or undefined when the folder holds none.
 */
export const readLastArchiveBackupTime = async(naming: BackupFileNaming, backupDirectory: string): Promise<Date | undefined> => {
	const archiveFileNames = await readArchiveBackupFileNames(naming, backupDirectory);
	const newestFileName = archiveFileNames[archiveFileNames.length - 1];

	return newestFileName === undefined ? undefined : readArchiveBackupTime(naming, newestFileName);
};

export const latestBackupExists = async(naming: BackupFileNaming, backupDirectory: string): Promise<boolean> => {
	try {
		return (await stat(getLatestBackupPath(naming, backupDirectory))).isFile();
	}
	catch {
		return false;
	}
};

// Shutdown abandons a copy that is taking too long, so the half-copied file it may leave behind is cleared by the next run
const removePartialBackupFiles = async(naming: BackupFileNaming, backupDirectory: string): Promise<void> => {
	const partialFileNames = (await readBackupDirectoryFileNames(backupDirectory)).filter((fileName) => {
		return isPartialBackupFileName(naming, fileName);
	});

	await Promise.all(partialFileNames.map((fileName) => {
		return rm(path.join(backupDirectory, fileName), { force: true });
	}));
};

// Only the dated copies the application itself wrote are removed, so the copy kept up to date beside them, and anything else the user
// keeps in the backup folder, is left alone
const pruneArchiveBackups = async(naming: BackupFileNaming, backupDirectory: string, retainedArchiveCount: number): Promise<void> => {
	const archiveFileNames = await readArchiveBackupFileNames(naming, backupDirectory);
	const excessCount = archiveFileNames.length - retainedArchiveCount;

	if(excessCount <= 0) {
		return;
	}

	await Promise.all(archiveFileNames.slice(0, excessCount).map((fileName) => {
		return rm(path.join(backupDirectory, fileName), { force: true });
	}));
};

/**
 * Writes the copy that is kept up to date, replacing the one already in the folder.
 *
 * The snapshot is built on the local disk first and only then published, so the backup folder never holds a database that is still
 * being written: a synchronization client watching that folder can therefore only ever see complete files. Overwriting the copy in
 * place would break exactly that, which is why the new one is published onto the old one with a rename rather than written over it.
 * @param options The database to copy, where the copy goes, and what it is called.
 * @param options.database The live database the snapshot is taken from.
 * @param options.backupDirectory The folder the copy is published into.
 * @param options.temporaryDirectory The local folder the snapshot is built in, which is never the backup folder.
 * @param options.naming How the copies are named.
 * @returns Where the copy landed.
 */
export const writeLatestBackup = async({
	database,
	backupDirectory,
	temporaryDirectory,
	naming
}: WriteLatestBackupOptions): Promise<string> => {
	const temporaryPath = path.join(temporaryDirectory, naming.temporaryFileName);
	const latestPath = getLatestBackupPath(naming, backupDirectory);
	const partialPath = `${latestPath}${naming.partialFileExtension}`;

	await mkdir(temporaryDirectory, { recursive: true });
	await mkdir(backupDirectory, { recursive: true });
	await removePartialBackupFiles(naming, backupDirectory);

	// VACUUM INTO refuses to write over an existing file, so a snapshot left behind by an interrupted copy is cleared first
	await rm(temporaryPath, { force: true });

	try {
		// Only this step touches the database, and it stays on the local disk: copying into a possibly slow backup folder happens afterwards
		database.vacuumInto(temporaryPath);

		await copyFile(temporaryPath, partialPath);
		await rename(partialPath, latestPath);
	}
	catch(error) {
		await rm(partialPath, { force: true });

		throw error;
	}
	finally {
		await rm(temporaryPath, { force: true });
	}

	return latestPath;
};

/**
 * Adds a dated copy to the folder and rotates the oldest ones out.
 *
 * **The dated copy is taken from the copy that is kept up to date, not from the database.** The two are then provably the same file,
 * and a dated copy costs no snapshot and no read transaction at all: the database is only ever touched when the up-to-date copy is
 * refreshed, which has already happened by the time a dated one is due.
 * @param options Where the copies live, what they are called, and how many dated ones the folder keeps.
 * @param options.backupDirectory The folder the copies live in.
 * @param options.naming How the copies are named.
 * @param options.retainedArchiveCount How many dated copies the folder keeps once this one is in it.
 * @param options.now What the copy is dated with.
 * @returns Where the dated copy landed.
 */
export const writeArchiveBackup = async({
	backupDirectory,
	naming,
	retainedArchiveCount,
	now = () => {
		return new Date();
	}
}: WriteArchiveBackupOptions): Promise<string> => {
	const latestPath = getLatestBackupPath(naming, backupDirectory);
	const archivePath = path.join(backupDirectory, createArchiveBackupFileName(naming, now()));
	const partialPath = `${archivePath}${naming.partialFileExtension}`;

	await mkdir(backupDirectory, { recursive: true });
	await removePartialBackupFiles(naming, backupDirectory);

	try {
		await copyFile(latestPath, partialPath);
		await rename(partialPath, archivePath);
	}
	catch(error) {
		await rm(partialPath, { force: true });

		throw error;
	}

	await pruneArchiveBackups(naming, backupDirectory, retainedArchiveCount);

	return archivePath;
};
