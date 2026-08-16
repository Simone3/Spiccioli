import type { Mock } from 'vitest';
import { resetAppLoggerForTests } from 'src/framework/main/logging/AppLogger';
import { createBackupScheduler, type CreateBackupSchedulerOptions } from 'src/framework/main/storage/BackupScheduler';
import type { BackupResult, BackupStatus } from 'src/framework/types/StorageTypes';

const BACKUP_DIRECTORY = '/tmp/app-backups';

const DELAY_AFTER_CHANGE_MS = 120000;

const SHUTDOWN_TIMEOUT_MS = 5000;

// The framework scheduler takes its delays from its caller, so the tests supply them once and override only what they exercise
const createTestScheduler = (options: Partial<CreateBackupSchedulerOptions> & Pick<CreateBackupSchedulerOptions, 'storage'>) => {
	return createBackupScheduler({
		delayAfterChangeMs: DELAY_AFTER_CHANGE_MS,
		shutdownTimeoutMs: SHUTDOWN_TIMEOUT_MS,
		...options
	});
};

const createSuccessfulBackup = (): BackupResult => {
	return {
		ok: true,
		backupPath: `${BACKUP_DIRECTORY}/spot-backup.sqlite`,
		status: {
			state: 'ok',
			directory: BACKUP_DIRECTORY,
			lastBackupAt: '2026-06-06T10:00:00.000Z'
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

const createFakeTaskStorage = (results: BackupResult[] = []): {
	createBackup: Mock<() => Promise<BackupResult>>;
} => {
	return {
		createBackup: vi.fn(() => {
			return Promise.resolve(results.shift() ?? createSuccessfulBackup());
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

	test('waits for the task changes to settle before backing up', async() => {
		const taskStorage = createFakeTaskStorage();
		const scheduler = createTestScheduler({ storage: taskStorage });

		scheduler.notifyDataChanged();
		vi.advanceTimersByTime(DELAY_AFTER_CHANGE_MS - 1);

		expect(taskStorage.createBackup).not.toHaveBeenCalled();

		// A later change restarts the wait instead of adding a second backup
		scheduler.notifyDataChanged();
		vi.advanceTimersByTime(DELAY_AFTER_CHANGE_MS - 1);

		expect(taskStorage.createBackup).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		await scheduler.runBackupNow();

		expect(taskStorage.createBackup).toHaveBeenCalledTimes(1);
	});

	test('does not back up again when nothing changed since the last backup', async() => {
		const taskStorage = createFakeTaskStorage();
		const scheduler = createTestScheduler({ storage: taskStorage });

		scheduler.notifyDataChanged();
		await scheduler.runBackupNow();
		await scheduler.runBackupNow();

		expect(taskStorage.createBackup).toHaveBeenCalledTimes(1);
	});

	test('reports the outcome of every backup it runs', async() => {
		const taskStorage = createFakeTaskStorage([ createFailedBackup(), createSuccessfulBackup() ]);
		const reportedStatuses: BackupStatus[] = [];
		const scheduler = createTestScheduler({
			storage: taskStorage,
			onBackupStatusChanged: (status) => {
				reportedStatuses.push(status);
			}
		});

		scheduler.notifyDataChanged();
		await scheduler.runBackupNow();

		// The failed backup left the changes pending, so the next run retries them without a new task change
		await scheduler.runBackupNow();

		expect(reportedStatuses.map((status) => {
			return status.state;
		})).toEqual([ 'failed', 'ok' ]);
	});

	test('runs backups on the storage chain', async() => {
		const taskStorage = createFakeTaskStorage();
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

	test('backs up once more on shutdown and cancels the pending schedule', async() => {
		const taskStorage = createFakeTaskStorage();
		const scheduler = createTestScheduler({ storage: taskStorage });

		scheduler.notifyDataChanged();
		await scheduler.runFinalBackup();

		expect(taskStorage.createBackup).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(DELAY_AFTER_CHANGE_MS);

		expect(taskStorage.createBackup).toHaveBeenCalledTimes(1);
	});

	// The database is the source of truth and is already saved, so a backup folder that stopped answering must not block the quit
	test('gives up on a shutdown backup that takes too long', async() => {
		let finishBackup: (() => void) | undefined;
		const taskStorage = {
			createBackup: vi.fn(() => {
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
		vi.advanceTimersByTime(5000);

		await expect(finalBackup).resolves.toBeUndefined();
		expect(finishBackup).toBeDefined();
	});
});
