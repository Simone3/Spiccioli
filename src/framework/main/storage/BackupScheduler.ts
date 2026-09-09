import { appLogger } from 'src/framework/main/logging/AppLogger';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';
import type { BackupResult, BackupStatus } from 'src/framework/types/StorageTypes';

interface BackupSchedulerStorage {
	syncLatestBackup: () => Promise<BackupResult>;
	archiveLatestBackup: () => Promise<BackupResult>;
	getLastArchiveTime: () => Promise<Date | undefined>;
}

export interface CreateBackupSchedulerOptions {
	storage: BackupSchedulerStorage;

	// How long the changes have to have been quiet before the up-to-date copy is refreshed
	delayAfterChangeMs: number;

	// How much older than the newest dated copy in the folder a run has to be before another dated copy is taken
	archiveIntervalMs: number;

	// How often that is checked, which is deliberately far shorter than the interval itself
	archiveCheckIntervalMs: number;

	shutdownTimeoutMs: number;

	// How many copies the folder keeps, read on every run because the user can change it while the application is open. A count of
	// zero writes nothing at all, and one keeps the up-to-date copy alone.
	getRetainedBackupCount: () => number;

	// Backups run on the same chain as the storage commands, so a snapshot is never taken while a write transaction is open
	runExclusively?: <TResult>(operation: () => Promise<TResult>) => Promise<TResult>;
	onBackupStatusChanged?: (status: BackupStatus) => void;
	now?: () => Date;
}

export interface BackupScheduler {
	start: () => void;
	notifyDataChanged: () => void;
	runBackupNow: () => Promise<void>;
	runFinalBackup: () => Promise<void>;
	stop: () => void;
}

const runWithTimeout = async(operation: Promise<void>, timeoutMs: number): Promise<void> => {
	let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<void>((resolve) => {
		timeoutHandle = setTimeout(resolve, timeoutMs);
	});

	try {
		await Promise.race([ operation, timeout ]);
	}
	finally {
		clearTimeout(timeoutHandle);
	}
};

/**
 * Decides when the local database is copied to the backup folder.
 *
 * The folder receives two kinds of copy and they answer two different questions. **The up-to-date copy** is refreshed once the
 * changes have been quiet for a while, and it answers "how much would I lose": it is overwritten every time, so it never grows and
 * never reaches back. **The dated copies** are added on a slow cadence and answer "how far back can I go": rotating them on every
 * change is what would make them useless, because a handful of copies would then only ever hold the last handful of edits.
 *
 * **The cadence of the dated copies is measured against the folder, not against the run.** The newest dated copy in the folder says
 * when the last one was taken, which survives a restart — so a session that is opened and closed all day cannot spend the whole
 * rotation in an afternoon, and a folder that was just selected is immediately due for one.
 *
 * Backups are best effort by design, so a failing one is logged and reported but never blocks a storage command or a quit.
 * @param options The storage to copy, the cadences to copy on, and how many copies to keep.
 * @param options.storage The storage the copies are taken from.
 * @param options.delayAfterChangeMs How long the changes have to have been quiet before the up-to-date copy is refreshed.
 * @param options.archiveIntervalMs How much older than the newest dated copy the folder has to be before another one is taken.
 * @param options.archiveCheckIntervalMs How often that is checked.
 * @param options.shutdownTimeoutMs How long a quit may be held for the copies that are due.
 * @param options.getRetainedBackupCount How many copies the folder keeps, counting the up-to-date one.
 * @param options.runExclusively Runs an operation on the serial storage chain.
 * @param options.onBackupStatusChanged Called with the outcome of every copy that is written.
 * @param options.now What a run is timed against.
 * @returns The scheduler.
 */
export const createBackupScheduler = ({
	storage,
	delayAfterChangeMs,
	archiveIntervalMs,
	archiveCheckIntervalMs,
	shutdownTimeoutMs,
	getRetainedBackupCount,
	runExclusively = (operation) => {
		return operation();
	},
	onBackupStatusChanged,
	now
}: CreateBackupSchedulerOptions): BackupScheduler => {
	let scheduledBackup: ReturnType<typeof setTimeout> | undefined;
	let archiveCheck: ReturnType<typeof setInterval> | undefined;
	let runningBackup: Promise<void> | undefined;
	let hasChangesSinceLatestCopy = false;
	let hasChangesSinceArchive = false;

	const getCurrentDate = (): Date => {
		return now ? now() : new Date();
	};

	const cancelScheduledBackup = (): void => {
		if(scheduledBackup === undefined) {
			return;
		}

		clearTimeout(scheduledBackup);
		scheduledBackup = undefined;
	};

	const isArchiveDue = async(): Promise<boolean> => {
		const lastArchiveTime = await storage.getLastArchiveTime();

		if(!lastArchiveTime) {
			return true;
		}

		return getCurrentDate().getTime() - lastArchiveTime.getTime() >= archiveIntervalMs;
	};

	/**
	 * Writes whichever copies are due, in the one order they can be written in.
	 *
	 * A copy that could not be written is worth retrying, so the changes it should have captured stay marked as pending. A successful
	 * one must not clear the flag instead, because an edit made while it was running has already set it again.
	 * @returns Nothing, once every copy that was due has been written or has failed.
	 */
	const runBackupCycle = async(): Promise<void> => {
		const retainedBackupCount = getRetainedBackupCount();

		// Keeping no copies means the folder is not written to at all, and what it already holds is left exactly as it is
		if(retainedBackupCount <= 0) {
			return;
		}

		if(hasChangesSinceLatestCopy) {
			hasChangesSinceLatestCopy = false;

			const latestResult = await runExclusively(() => {
				return storage.syncLatestBackup();
			});

			onBackupStatusChanged?.(latestResult.status);

			// The dated copy is taken from the up-to-date one, so there is nothing to take a dated copy of
			if(!latestResult.ok) {
				hasChangesSinceLatestCopy = true;

				return;
			}
		}

		// One copy is the up-to-date one alone: a dated copy would be rotated out the moment it was written
		if(retainedBackupCount < 2 || !hasChangesSinceArchive || !await isArchiveDue()) {
			return;
		}

		hasChangesSinceArchive = false;

		const archiveResult = await runExclusively(() => {
			return storage.archiveLatestBackup();
		});

		if(!archiveResult.ok) {
			hasChangesSinceArchive = true;
		}

		onBackupStatusChanged?.(archiveResult.status);
	};

	// Edits made while a cycle runs schedule the next one instead of starting a second overlapping cycle
	const runBackupNow = (): Promise<void> => {
		cancelScheduledBackup();

		const backup = (runningBackup ?? Promise.resolve())
			.then(runBackupCycle)
			.catch((error: unknown) => {
				hasChangesSinceLatestCopy = true;
				hasChangesSinceArchive = true;

				appLogger.error('The scheduled database backup failed', {
					type: 'storage.backup',
					error: getErrorMessage(error)
				});
			})
			.finally(() => {
				if(runningBackup === backup) {
					runningBackup = undefined;
				}
			});

		runningBackup = backup;

		return backup;
	};

	const notifyDataChanged = (): void => {
		hasChangesSinceLatestCopy = true;
		hasChangesSinceArchive = true;
		cancelScheduledBackup();

		scheduledBackup = setTimeout(() => {
			scheduledBackup = undefined;
			void runBackupNow();
		}, delayAfterChangeMs);
	};

	// The check costs nothing until a dated copy is actually due: a run with no unarchived change never reaches the folder
	const start = (): void => {
		if(archiveCheck !== undefined) {
			return;
		}

		archiveCheck = setInterval(() => {
			void runBackupNow();
		}, archiveCheckIntervalMs);
	};

	const stop = (): void => {
		cancelScheduledBackup();

		if(archiveCheck !== undefined) {
			clearInterval(archiveCheck);
			archiveCheck = undefined;
		}
	};

	// A backup folder that has become slow or unreachable must not hold up the quit: the database is the source of truth and it is already saved
	const runFinalBackup = async(): Promise<void> => {
		stop();

		await runWithTimeout(runBackupNow(), shutdownTimeoutMs);
	};

	return {
		start,
		notifyDataChanged,
		runBackupNow,
		runFinalBackup,
		stop
	};
};
