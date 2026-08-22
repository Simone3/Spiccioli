import { readWholeFileIfPresent, writeWholeFileAtomically, type WholeFileWriteResult } from 'src/framework/main/storage/WholeFileStorage';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';

/**
 * One document file, written whole, atomically, and more than once if it has to be.
 *
 * Three things live here and they are all about bytes rather than about what the bytes mean.
 *
 * **The spaced retries.** A write that fails is tried again a fixed number of times, a few seconds apart rather than back to
 * back — the failures worth retrying are a volume that went away, a file a backup tool has open, a disk that is momentarily
 * full, and none of those clears inside a millisecond. Every attempt is reported as it fails, so the application can say so on
 * screen while they run, and the caller is told which attempt succeeded or that all of them failed.
 *
 * **External-modification detection.** The fingerprint of the bytes is recorded at every read and every write, and the file is
 * re-read and re-fingerprinted before each attempt. A mismatch means something else wrote the file, and the writer hands the
 * displaced bytes to the application before overwriting them — what is done with them is the application's decision, and this
 * module only guarantees they are offered before they are lost. **One write hands one version over once**, however many
 * attempts it takes: the attempts behind the first would otherwise offer the same displaced bytes again for as long as the
 * write kept failing.
 *
 * **The timeout.** An attempt that has not finished in time is counted as a failed one. A write that then completes anyway has
 * written exactly the bytes the retry is about to write again, so the worst it can do is make the retry redundant.
 */

export interface FileWriteAttemptFailure {

	// Counting from 1, the way the message on screen counts it
	attempt: number;
	message: string;

	// How long until the next attempt, or undefined when that was the last one
	nextAttemptInMs: number | undefined;
}

export interface ExternalModification {
	recordedHash: string;
	foundHash: string | undefined;

	// The bytes that are about to be overwritten, or undefined when the file was deleted rather than changed
	displacedContents: string | undefined;
}

export type FileWriteOutcome = {
	ok: true;
	attempts: number;
	result: WholeFileWriteResult;
} | {
	ok: false;
	attempts: number;
	message: string;
};

export interface CreateRetryingFileWriterOptions {
	filePath: string;
	temporaryFilePath: string;
	maximumAttempts: number;
	retryDelayMs: number;
	writeTimeoutMs: number;

	// Reported to the user as what stopped the write, so the wording is the application's
	writeTimeoutMessage: string;

	onAttemptFailed?: (failure: FileWriteAttemptFailure) => void;

	// Awaited before the displaced bytes are overwritten, so that an application that wants to keep them can
	onExternalModification?: (modification: ExternalModification) => Promise<void> | void;

	delay?: (durationMs: number) => Promise<void>;
	now?: () => number;
}

export interface RetryingFileWriter {

	// Recorded after the application reads or creates the file, and what every later write compares the file on disk against
	recordHash: (hash: string) => void;
	getRecordedHash: () => string | undefined;
	write: (contents: string) => Promise<FileWriteOutcome>;
}

const defaultDelay = (durationMs: number): Promise<void> => {
	return new Promise((resolve) => {
		setTimeout(resolve, durationMs);
	});
};

/**
 * Stops waiting for an operation after a while.
 * The operation itself cannot be cancelled, so this only decides when to stop waiting for it: a write that then completes anyway
 * has written exactly the bytes the retry is about to write again. The timer is cleared either way, so a slow-but-successful
 * write does not keep the process alive.
 * @param operation What to wait for.
 * @param timeoutMs How long to wait.
 * @param timeoutMessage What the failure says, which is the application's wording rather than the framework's.
 * @returns What the operation produced, or a rejection carrying that message.
 */
export const withTimeout = async <TResult>(operation: Promise<TResult>, timeoutMs: number, timeoutMessage: string): Promise<TResult> => {
	let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

	const timeout = new Promise<never>((_, reject) => {
		timeoutHandle = setTimeout(() => {
			reject(new Error(timeoutMessage));
		}, timeoutMs);
	});

	try {
		return await Promise.race([ operation, timeout ]);
	}
	finally {
		if(timeoutHandle) {
			clearTimeout(timeoutHandle);
		}
	}
};

export const createRetryingFileWriter = ({
	filePath,
	temporaryFilePath,
	maximumAttempts,
	retryDelayMs,
	writeTimeoutMs,
	writeTimeoutMessage,
	onAttemptFailed,
	onExternalModification,
	delay = defaultDelay,
	now
}: CreateRetryingFileWriterOptions): RetryingFileWriter => {
	let recordedHash: string | undefined;

	const write = async(contents: string): Promise<FileWriteOutcome> => {
		let lastMessage = '';

		/**
		 * The version this write has already handed over, so that the attempts behind the first one do not hand the same bytes
		 * over again. A failing write has five attempts, and a file that was modified underneath it is still modified at every
		 * one of them: reporting it each time would offer the same displaced version five times over, and where the application
		 * keeps those copies to a count, four of them would be spent pushing four real ones out.
		 *
		 * **It is per write and not per writer.** The same bytes arriving again after a write has succeeded are a second
		 * modification and are worth reporting a second time, and the recorded hash the check runs against has moved on by then.
		 */
		let alreadyHandedOver: { foundHash: string | undefined } | undefined;

		// A file nothing has read yet has nothing to compare against, so the first write of a brand new file is not a modification
		const reportExternalModification = async(): Promise<void> => {
			if(!recordedHash || !onExternalModification) {
				return;
			}

			const found = await readWholeFileIfPresent(filePath);

			if(found?.hash === recordedHash) {
				return;
			}

			if(alreadyHandedOver && alreadyHandedOver.foundHash === found?.hash) {
				return;
			}

			await onExternalModification({
				recordedHash,
				foundHash: found?.hash,
				displacedContents: found?.contents
			});

			// Marked only once it has actually been handed over: a report that threw preserved nothing, and the attempt behind
			// it must not overwrite bytes this one failed to offer up
			alreadyHandedOver = { foundHash: found?.hash };
		};

		for(let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
			try {
				await reportExternalModification();

				const result = await withTimeout(
					writeWholeFileAtomically({ filePath, temporaryFilePath, contents, now }),
					writeTimeoutMs,
					writeTimeoutMessage
				);

				recordedHash = result.hash;

				return {
					ok: true,
					attempts: attempt,
					result
				};
			}
			catch(error) {
				lastMessage = getErrorMessage(error);

				const isLastAttempt = attempt === maximumAttempts;

				onAttemptFailed?.({
					attempt,
					message: lastMessage,
					nextAttemptInMs: isLastAttempt ? undefined : retryDelayMs
				});

				if(!isLastAttempt) {
					await delay(retryDelayMs);
				}
			}
		}

		return {
			ok: false,
			attempts: maximumAttempts,
			message: lastMessage
		};
	};

	return {
		recordHash: (hash) => {
			recordedHash = hash;
		},
		getRecordedHash: () => {
			return recordedHash;
		},
		write
	};
};
