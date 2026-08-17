import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Reading and writing a whole file, and recognising one that changed underneath.
 *
 * This module moves bytes and never learns what is in them: it has no idea what a document holds, what it is for, or whether it
 * is valid. An application that wants a file read whole and written whole gets exactly that, plus the two properties that make
 * it safe — the write is atomic, and the file is fingerprinted so that a later write can tell whether anything else touched it.
 *
 * **The write is atomic by temp-file-and-rename.** The bytes go to a temporary file in the same directory and that file is then
 * renamed over the target. A rename inside one directory is atomic on every platform this runs on, so an interrupted write
 * leaves either the old file or the new one, never a truncated one. The temporary file has to be in the same directory for
 * that to hold: a rename across filesystems is a copy, and a copy is not atomic.
 */

export interface WholeFileContents {
	contents: string;
	sizeBytes: number;

	// The fingerprint of exactly these bytes, which is what a later write compares against to notice an external modification
	hash: string;
}

export interface WholeFileWriteResult {
	hash: string;
	sizeBytes: number;
	writeDurationMs: number;
	renameDurationMs: number;
}

export interface WriteWholeFileOptions {
	filePath: string;
	temporaryFilePath: string;
	contents: string;
	now?: () => number;
}

/**
 * Fingerprints the exact bytes of a file's contents.
 * SHA-256 because the question being asked is whether these bytes are the ones that were there before, and a hash a person
 * could collide on purpose is not a hash worth recording.
 * @param contents The whole file, as text.
 * @returns The fingerprint, as hexadecimal.
 */
export const hashFileContents = (contents: string): string => {
	return createHash('sha256').update(contents, 'utf8').digest('hex');
};

/**
 * Reads a whole file and fingerprints it.
 * @param filePath The file.
 * @returns Its contents, its size and its fingerprint.
 */
export const readWholeFile = async(filePath: string): Promise<WholeFileContents> => {
	const contents = await readFile(filePath, 'utf8');

	return {
		contents,
		sizeBytes: Buffer.byteLength(contents, 'utf8'),
		hash: hashFileContents(contents)
	};
};

/**
 * Reads a whole file, treating a missing one as nothing rather than as a failure.
 * Used before a write, where the question is whether the file is still the one that was read, and a file that is not there
 * anymore is one answer to it.
 * @param filePath The file.
 * @returns Its contents, or undefined when it does not exist.
 */
export const readWholeFileIfPresent = async(filePath: string): Promise<WholeFileContents | undefined> => {
	try {
		return await readWholeFile(filePath);
	}
	catch(error) {
		if((error as { code?: string }).code === 'ENOENT') {
			return undefined;
		}

		throw error;
	}
};

/**
 * Writes a whole file atomically, and fingerprints what it wrote.
 *
 * The temporary file is removed when the write fails, so a disk that filled up halfway through does not leave a partial file
 * beside the real one for the next run to wonder about.
 * @param options The file, the temporary file beside it, and the bytes.
 * @param options.filePath The file to write.
 * @param options.temporaryFilePath The file the bytes go to before they are renamed onto it.
 * @param options.contents The bytes.
 * @param options.now The clock the durations are measured against.
 * @returns The fingerprint of what was written, and how long each half of the write took.
 */
export const writeWholeFileAtomically = async({
	filePath,
	temporaryFilePath,
	contents,
	now = () => {
		return Date.now();
	}
}: WriteWholeFileOptions): Promise<WholeFileWriteResult> => {
	await mkdir(path.dirname(filePath), { recursive: true });

	const writeStartedAt = now();

	try {
		await writeFile(temporaryFilePath, contents, 'utf8');
	}
	catch(error) {
		await rm(temporaryFilePath, { force: true }).catch(() => {
			return undefined;
		});

		throw error;
	}

	const renameStartedAt = now();

	try {
		await rename(temporaryFilePath, filePath);
	}
	catch(error) {
		await rm(temporaryFilePath, { force: true }).catch(() => {
			return undefined;
		});

		throw error;
	}

	return {
		hash: hashFileContents(contents),
		sizeBytes: Buffer.byteLength(contents, 'utf8'),
		writeDurationMs: renameStartedAt - writeStartedAt,
		renameDurationMs: now() - renameStartedAt
	};
};
