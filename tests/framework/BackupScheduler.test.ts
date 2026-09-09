import type { Mock } from 'vitest';
import { resetAppLoggerForTests } from 'src/framework/main/logging/AppLogger';
import { createBackupScheduler, type CreateBackupSchedulerOptions } from 'src/framework/main/storage/BackupScheduler';
import type { BackupResult, BackupStatus } from 'src/framework/types/StorageTypes';

const BACKUP_DIRECTORY = '/tmp/app-backups';

const DELAY_AFTER_CHANGE_MS = 120000;

const ARCHIVE_INTERVAL_MS = 12 * 60 * 60 * 1000;

const ARCHIVE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

const SHUTDOWN_TIMEOUT_MS = 15000;

const RETAINED_BACKUP_COUNT = 10;

const NOW = new Date('2026-06-06T12:00:00.000Z');

// The framework scheduler takes its delays and its copy count from its caller, so the tests supply them once and override only what they exercise
const createTestScheduler = (options: Partial<CreateBackupSchedulerOptions> & Pick<CreateBackupSchedulerOptions, 'storage'>) => {
	return createBackupScheduler({
		delayAfterChangeMs: DELAY_AFTER_CHANGE_MS,
		archiveIntervalMs: ARCHIVE_INTERVAL_MS,
		archiveCheckIntervalMs: ARCHIVE_CHECK_INTERVAL_MS,
		shutdownTimeoutMs: SHUTDOWN_TIMEOUT_MS,
		getRetainedBackupCount: () => {
			return RETAINED_BACKUP_COUNT;
		},
		now: () => {
			return NOW;
		},
		...options
	});
};

const createSuccessfulBackup = (): BackupResult => {
	return {
		ok: true,
		backupPath: `${BACKUP_DIRECTORY}/app-backup-latest.sqlite`,
		status: {
			state: 'ok',
			directory: BACKUP_DIRECTORY,
			latestCopyAt: '2026-06-06T10:00:00.000Z'
		}
	};
};

const createFailedBackup = (): BackupResult => {
	return {
		ok: false,
		message: 'The backup folder is not available.',
		status: {
			state: 'failed',
			directory: BACKUP_DIRECTORY,
			message: 'The backup folder is not available.'
		}
	};
};

interface FakeBackupStorage {
	syncLatestBackup: Mock<() => Promise<BackupResult>>;
	archiveLatestBackup: Mock<() => Promise<BackupResult>>;
	getLastArchiveTime: Mock<() => Promise<Date | undefined>>;
}

const createFakeTaskStorage = (
	{ latestResults = [], archiveResults = [], lastArchiveTime }: {
		latestResults?: BackupResult[];
		archiveResults?: BackupResult[];
		lastArchiveTime?: Date;
	} = {}
): FakeBackupStorage => {
	return {
		syncLatestBackup: vi.fn(() => {
			return Promise.resolve(latestResults.shift() ?? createSuccessfulBackup());
		}),
		archiveLatestBackup: vi.fn(() => {
			return Promise.resolve(archiveResults.shift() ?? createSuccessfulBackup());
		}),
		getLastArchiveTime: vi.fn(() => {
			return Promise.resolve(lastArchiveTime);
		})
	};
};

describe('BackupScheduler', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		resetAppLoggerForTests();
	});

	test('waits for the task changes to settle before refreshing the copy kept up to date', async() => {
		const taskStorage = createFakeTaskStorage({ lastArchiveTime: NOW });
		const scheduler = createTestScheduler({ storage: taskStorage });

		scheduler.notifyDataChanged();
		vi.advanceTimersByTime(DELAY_AFTER_CHANGE_MS - 1);

		expect(taskStorage.syncLatestBackup).not.toHaveBeenCalled();

		// A later change restarts the wait instead of adding a second copy
		scheduler.notifyDataChanged();
		vi.advanceTimersByTime(DELAY_AFTER_CHANGE_MS - 1);

		expect(taskStorage.syncLatestBackup).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		await scheduler.runBackupNow();

		expect(taskStorage.syncLatestBackup).toHaveBeenCalledTimes(1);
	});

	test('does not copy again when nothing changed since the last copy', async() => {
		const taskStorage = createFakeTaskStorage({ lastArchiveTime: NOW });
		const scheduler = createTestScheduler({ storage: taskStorage });

		scheduler.notifyDataChanged();
		await scheduler.runBackupNow();
		await scheduler.runBackupNow();

		expect(taskStorage.syncLatestBackup).toHaveBeenCalledTimes(1);
	});

	test('reports the outcome of every copy it writes', async() => {
		const taskStorage = createFakeTaskStorage({
			latestResults: [ createFailedBackup(), createSuccessfulBackup() ],
			lastArchiveTime: NOW
		});
		const reportedStatuses: BackupStatus[] = [];
		const scheduler = createTestScheduler({
			storage: taskStorage,
			onBackupStatusChanged: (status) => {
				reportedStatuses.push(status);
			}
		});

		scheduler.notifyDataChanged();
		await scheduler.runBackupNow();

		// The failed copy left the changes pending, so the next run retries them without a new task change
		await scheduler.runBackupNow();

		expect(reportedStatuses.map((status) => {
			return status.state;
		})).toEqual([ 'failed', 'ok' ]);
	});

	test('runs backups on the storage chain', async() => {
		const taskStorage = createFakeTaskStorage({ lastArchiveTime: NOW });
		const trackExclusiveRun = vi.fn();
		const runExclusively = <TResult>(operation: () => Promise<TResult>): Promise<TResult> => {
			trackExclusiveRun();

			return operation();
		};
		const scheduler = createTestScheduler({ storage: taskStorage, runExclusively });

		scheduler.notifyDataChanged();
		await scheduler.runBackupNow();

		expect(trackExclusiveRun).toHaveBeenCalledTimes(1);
	});

	// A folder that has never received one reaches back nowhere at all, which is exactly what a first dated copy is for
	test('takes a dated copy when the folder has none yet', async() => {
		const taskStorage = createFakeTaskStorage();
		const scheduler = createTestScheduler({ storage: taskStorage });

		scheduler.notifyDataChanged();
		await scheduler.runBackupNow();

		expect(taskStorage.syncLatestBackup).toHaveBeenCalledTimes(1);
		expect(taskStorage.archiveLatestBackup).toHaveBeenCalledTimes(1);
	});

	// Opening and closing the application all day must not spend the whole rotation on one day of work
	test('leaves the dated copies alone until the folder is old enough for another', async() => {
		const taskStorage = createFakeTaskStorage({
			lastArchiveTime: new Date(NOW.getTime() - ARCHIVE_INTERVAL_MS + 1)
		});
		const scheduler = createTestScheduler({ storage: taskStorage });

		scheduler.notifyDataChanged();
		await scheduler.runBackupNow();

		expect(taskStorage.syncLatestBackup).toHaveBeenCalledTimes(1);
		expect(taskStorage.archiveLatestBackup).not.toHaveBeenCalled();
	});

	test('takes a dated copy once the folder is old enough for another', async() => {
		const taskStorage = createFakeTaskStorage({
			lastArchiveTime: new Date(NOW.getTime() - ARCHIVE_INTERVAL_MS)
		});
		const scheduler = createTestScheduler({ storage: taskStorage });

		scheduler.notifyDataChanged();
		await scheduler.runBackupNow();

		expect(taskStorage.archiveLatestBackup).toHaveBeenCalledTimes(1);
	});

	// A dated copy is taken from the up-to-date one, so there is nothing to take when that one could not be written
	test('does not take a dated copy when the copy kept up to date failed', async() => {
		const taskStorage = createFakeTaskStorage({ latestResults: [ createFailedBackup() ] });
		const scheduler = createTestScheduler({ storage: taskStorage });

		scheduler.notifyDataChanged();
		await scheduler.runBackupNow();

		expect(taskStorage.archiveLatestBackup).not.toHaveBeenCalled();
	});

	test('keeps only the copy that is up to date when that is all the folder keeps', async() => {
		const taskStorage = createFakeTaskStorage();
		const scheduler = createTestScheduler({
			storage: taskStorage,
			getRetainedBackupCount: () => {
				return 1;
			}
		});

		scheduler.notifyDataChanged();
		await scheduler.runBackupNow();

		expect(taskStorage.syncLatestBackup).toHaveBeenCalledTimes(1);
		expect(taskStorage.archiveLatestBackup).not.toHaveBeenCalled();
	});

	// Keeping no copies means the folder is never written to, and what it already holds is left exactly as it is
	test('writes nothing at all when no copies are kept', async() => {
		const taskStorage = createFakeTaskStorage();
		const scheduler = createTestScheduler({
			storage: taskStorage,
			getRetainedBackupCount: () => {
				return 0;
			}
		});

		scheduler.notifyDataChanged();
		await scheduler.runBackupNow();
		await scheduler.runFinalBackup();

		expect(taskStorage.syncLatestBackup).not.toHaveBeenCalled();
		expect(taskStorage.archiveLatestBackup).not.toHaveBeenCalled();
		expect(taskStorage.getLastArchiveTime).not.toHaveBeenCalled();
	});

	// A dated copy comes due while the application is simply left open, with no task change to notice it. A machine that slept through
	// a single long timer would fire it late and at an hour nothing chose, so the scheduler checks instead of counting down.
	test('notices on its own that a dated copy has become due', async() => {
		const taskStorage = createFakeTaskStorage({
			lastArchiveTime: new Date(NOW.getTime() - ARCHIVE_INTERVAL_MS + 1)
		});
		const scheduler = createTestScheduler({ storage: taskStorage });

		scheduler.start();
		scheduler.notifyDataChanged();
		vi.advanceTimersByTime(DELAY_AFTER_CHANGE_MS);
		await scheduler.runBackupNow();

		expect(taskStorage.archiveLatestBackup).not.toHaveBeenCalled();

		taskStorage.getLastArchiveTime.mockResolvedValue(new Date(NOW.getTime() - ARCHIVE_INTERVAL_MS));
		vi.advanceTimersByTime(ARCHIVE_CHECK_INTERVAL_MS);
		await scheduler.runBackupNow();

		expect(taskStorage.archiveLatestBackup).toHaveBeenCalledTimes(1);

		// Nothing changed in the meantime, so the dated copy cost no second snapshot of the database
		expect(taskStorage.syncLatestBackup).toHaveBeenCalledTimes(1);

		scheduler.stop();
	});

	test('copies once more on shutdown and cancels every pending schedule', async() => {
		const taskStorage = createFakeTaskStorage({ lastArchiveTime: NOW });
		const scheduler = createTestScheduler({ storage: taskStorage });

		scheduler.start();
		scheduler.notifyDataChanged();
		await scheduler.runFinalBackup();

		expect(taskStorage.syncLatestBackup).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(DELAY_AFTER_CHANGE_MS + ARCHIVE_CHECK_INTERVAL_MS);

		expect(taskStorage.syncLatestBackup).toHaveBeenCalledTimes(1);
	});

	// The database is the source of truth and is already saved, so a backup folder that stopped answering must not block the quit
	test('gives up on a shutdown backup that takes too long', async() => {
		let finishBackup: (() => void) | undefined;
		const taskStorage = {
			...createFakeTaskStorage(),
			syncLatestBackup: vi.fn(() => {
				return new Promise<BackupResult>((resolve) => {
					finishBackup = () => {
						resolve(createSuccessfulBackup());
					};
				});
			})
		};
		const scheduler = createTestScheduler({ storage: taskStorage, shutdownTimeoutMs: SHUTDOWN_TIMEOUT_MS });

		scheduler.notifyDataChanged();

		const finalBackup = scheduler.runFinalBackup();
		vi.advanceTimersByTime(SHUTDOWN_TIMEOUT_MS);

		await expect(finalBackup).resolves.toBeUndefined();
		expect(finishBackup).toBeDefined();
	});
});
