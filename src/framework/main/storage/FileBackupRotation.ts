import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { writeWholeFileAtomically } from 'src/framework/main/storage/WholeFileStorage';

/**
 * A folder of copies, kept to a count.
 *
 * **Rotation happens as copies arrive, oldest out first.** Writing the copy that would take the folder past its count is what
 * removes the oldest, and nothing else here ever deletes one — so lowering the count removes nothing on its own, and the folder
 * comes down to the new number over the next few copies.
 *
 * The framework decides how many copies there are and which of them is oldest; it does not decide what one is called. The
 * application passes the name and a way to recognise its own copies, so that nothing else the folder happens to hold is ever
 * mistaken for one and rotated out. The names are expected to sort chronologically, which is what makes "oldest" a sort rather
 * than a stat of every file in the folder.
 *
 * A copy is written atomically like any other whole file: a torn copy that looks complete would be worse than no copy at all.
 */

export interface WriteBackupCopyOptions {
	backupDirectory: string;
	backupFileName: string;
	contents: string;
	retainedCount: number;

	// Which of the folder's files are copies this rotation owns. Everything else in the folder is left alone.
	isBackupFileName: (fileName: string) => boolean;

	// Written beside the copy and renamed onto it, so it must not be a name "isBackupFileName" recognises
	temporaryFileSuffix: string;
}

export interface BackupCopyResult {
	backupPath: string;

	// How many copies the folder holds now that this one is in it and the rotation has run
	retainedCount: number;

	// What this copy pushed out, oldest first. Empty except on the copy that fills the folder.
	rotatedOutFileNames: string[];
}

/**
 * Writes one copy into the folder and rotates the oldest ones out.
 * @param options Where the copy goes, what it is called, what is in it, and how many the folder keeps.
 * @param options.backupDirectory The folder the copies live in.
 * @param options.backupFileName What this copy is called.
 * @param options.contents The bytes to copy.
 * @param options.retainedCount How many copies the folder keeps.
 * @param options.isBackupFileName Which of the folder's files are copies this rotation owns.
 * @param options.temporaryFileSuffix What the copy's temporary file is called while it is being written.
 * @returns Where the copy landed, how many copies there now are, and which were rotated out.
 */
export const writeBackupCopy = async({
	backupDirectory,
	backupFileName,
	contents,
	retainedCount,
	isBackupFileName,
	temporaryFileSuffix
}: WriteBackupCopyOptions): Promise<BackupCopyResult> => {
	const backupPath = path.join(backupDirectory, backupFileName);

	await mkdir(backupDirectory, { recursive: true });
	await writeWholeFileAtomically({
		filePath: backupPath,
		temporaryFilePath: `${backupPath}${temporaryFileSuffix}`,
		contents
	});

	const backupFileNames = (await readdir(backupDirectory)).filter(isBackupFileName).sort();
	const rotatedOutFileNames = backupFileNames.slice(0, Math.max(0, backupFileNames.length - retainedCount));

	for(const fileName of rotatedOutFileNames) {
		await rm(path.join(backupDirectory, fileName), { force: true });
	}

	return {
		backupPath,
		retainedCount: backupFileNames.length - rotatedOutFileNames.length,
		rotatedOutFileNames
	};
};
