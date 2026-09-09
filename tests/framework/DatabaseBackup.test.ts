import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resetAppLoggerForTests } from 'src/framework/main/logging/AppLogger';
import { openAppDatabase, type AppDatabase, type DatabaseMigration } from 'src/framework/main/storage/AppDatabase';
import { createArchiveBackupFileName, getLatestBackupPath, isArchiveBackupFileName, latestBackupExists, readArchiveBackupFileNames, readLastArchiveBackupTime, writeArchiveBackup, writeLatestBackup } from 'src/framework/main/storage/DatabaseBackup';
import type { BackupFileNaming } from 'src/framework/types/BackupTypes';

const TEST_BACKUP_NAMING: BackupFileNaming = {
	filePrefix: 'test-backup-',
	fileExtension: '.sqlite',
	partialFileExtension: '.part',
	temporaryFileName: 'test-backup.tmp.sqlite',
	latestFileName: 'test-backup-latest.sqlite'
};

const TEST_RETAINED_ARCHIVE_COUNT = 5;

const TEST_DATABASE_FILE_NAME = 'test.sqlite';

const TEST_SCHEMA_VERSION = 1;

const TEST_MIGRATIONS: readonly DatabaseMigration[] = [
	{
		version: TEST_SCHEMA_VERSION,
		apply: (database) => {
			database.execQuery('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY)');
		}
	}
];

const tempDirectories: string[] = [];
const openedDatabases: AppDatabase[] = [];

const makeTempDirectory = (): string => {
	const directory = mkdtempSync(path.join(tmpdir(), 'database-backup-'));
	tempDirectories.push(directory);

	return directory;
};

const openTrackedDatabase = (storageDirectory: string): AppDatabase => {
	const database = openAppDatabase({
		storageDirectory,
		databaseFileName: TEST_DATABASE_FILE_NAME,
		migrations: TEST_MIGRATIONS,
		timeoutMs: 5000,
		now: () => {
			return new Date('2026-06-06T09:00:00.000Z');
		}
	});
	openedDatabases.push(database);

	return database;
};

const createFixedDates = (): () => Date => {
	let index = 0;

	return () => {
		const minute = String(index).padStart(2, '0');
		index += 1;

		return new Date(`2026-06-06T10:${minute}:00.000Z`);
	};
};

describe('DatabaseBackup', () => {
	afterEach(() => {
		while(openedDatabases.length > 0) {
			openedDatabases.pop()!.close();
		}

		resetAppLoggerForTests();

		while(tempDirectories.length > 0) {
			rmSync(tempDirectories.pop()!, { recursive: true, force: true });
		}
	});

	test('names dated copies so that they sort chronologically and can be read back', () => {
		const older = createArchiveBackupFileName(TEST_BACKUP_NAMING, new Date('2026-06-06T09:30:00.000Z'));
		const newer = createArchiveBackupFileName(TEST_BACKUP_NAMING, new Date('2026-06-06T10:00:00.000Z'));

		expect(isArchiveBackupFileName(TEST_BACKUP_NAMING, older)).toBe(true);
		expect([ newer, older ].sort()).toEqual([ older, newer ]);
		expect(isArchiveBackupFileName(TEST_BACKUP_NAMING, TEST_BACKUP_NAMING.temporaryFileName)).toBe(false);
		expect(isArchiveBackupFileName(TEST_BACKUP_NAMING, `${older}${TEST_BACKUP_NAMING.partialFileExtension}`)).toBe(false);
	});

	// The two kinds of copy share one folder, so the copy that is kept up to date must never be counted as one of the dated ones:
	// the rotation would otherwise be free to delete the most valuable file in the folder
	test('never mistakes the copy kept up to date for a dated one', () => {
		expect(isArchiveBackupFileName(TEST_BACKUP_NAMING, TEST_BACKUP_NAMING.latestFileName)).toBe(false);
		expect(isArchiveBackupFileName(TEST_BACKUP_NAMING, 'test-backup-notes.sqlite')).toBe(false);
		expect(isArchiveBackupFileName(TEST_BACKUP_NAMING, 'something-else.sqlite')).toBe(false);
	});

	test('writes a complete database copy and leaves no temporary file behind', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = makeTempDirectory();
		const database = openTrackedDatabase(storageDirectory);

		const backupPath = await writeLatestBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory,
			naming: TEST_BACKUP_NAMING
		});

		expect(backupPath).toBe(getLatestBackupPath(TEST_BACKUP_NAMING, backupDirectory));
		expect(await latestBackupExists(TEST_BACKUP_NAMING, backupDirectory)).toBe(true);
		expect(existsSync(path.join(storageDirectory, TEST_BACKUP_NAMING.temporaryFileName))).toBe(false);
		expect(await readArchiveBackupFileNames(TEST_BACKUP_NAMING, backupDirectory)).toEqual([]);

		// A copy that cannot be opened as a database would be worthless as a backup
		const restoredDirectory = makeTempDirectory();
		copyFileSync(backupPath, path.join(restoredDirectory, TEST_DATABASE_FILE_NAME));

		expect(openTrackedDatabase(restoredDirectory).getAppliedMigrationVersions()).toEqual([ TEST_SCHEMA_VERSION ]);
	});

	// Nothing else in the folder would be safe to overwrite in place, so the new copy is published onto the old one instead
	test('replaces the copy kept up to date without leaving a second one behind', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = makeTempDirectory();
		const database = openTrackedDatabase(storageDirectory);

		const firstPath = await writeLatestBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory,
			naming: TEST_BACKUP_NAMING
		});
		const secondPath = await writeLatestBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory,
			naming: TEST_BACKUP_NAMING
		});

		expect(secondPath).toBe(firstPath);
		expect(readdirSync(backupDirectory)).toEqual([ TEST_BACKUP_NAMING.latestFileName ]);
	});

	test('creates the backup folder when it does not exist yet', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = path.join(makeTempDirectory(), 'nested', 'backups');
		const database = openTrackedDatabase(storageDirectory);

		await writeLatestBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory,
			naming: TEST_BACKUP_NAMING
		});

		expect(await latestBackupExists(TEST_BACKUP_NAMING, backupDirectory)).toBe(true);
	});

	// The dated copy costs no snapshot at all: it is the file the up-to-date copy already published
	test('takes a dated copy from the copy kept up to date', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = makeTempDirectory();
		const database = openTrackedDatabase(storageDirectory);

		const latestPath = await writeLatestBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory,
			naming: TEST_BACKUP_NAMING
		});
		const archivePath = await writeArchiveBackup({
			backupDirectory,
			naming: TEST_BACKUP_NAMING,
			retainedArchiveCount: TEST_RETAINED_ARCHIVE_COUNT,
			now: createFixedDates()
		});

		expect(readFileSync(archivePath)).toEqual(readFileSync(latestPath));
		expect(await readArchiveBackupFileNames(TEST_BACKUP_NAMING, backupDirectory)).toEqual([ path.basename(archivePath) ]);
		expect(await latestBackupExists(TEST_BACKUP_NAMING, backupDirectory)).toBe(true);
	});

	test('reads back when the newest dated copy was written', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = makeTempDirectory();
		const database = openTrackedDatabase(storageDirectory);

		expect(await readLastArchiveBackupTime(TEST_BACKUP_NAMING, backupDirectory)).toBeUndefined();

		await writeLatestBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory,
			naming: TEST_BACKUP_NAMING
		});

		const now = createFixedDates();

		await writeArchiveBackup({ backupDirectory, naming: TEST_BACKUP_NAMING, retainedArchiveCount: TEST_RETAINED_ARCHIVE_COUNT, now });
		await writeArchiveBackup({ backupDirectory, naming: TEST_BACKUP_NAMING, retainedArchiveCount: TEST_RETAINED_ARCHIVE_COUNT, now });

		expect(await readLastArchiveBackupTime(TEST_BACKUP_NAMING, backupDirectory)).toEqual(new Date('2026-06-06T10:01:00.000Z'));
	});

	test('keeps only the most recent dated copies and leaves other files alone', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = makeTempDirectory();
		const database = openTrackedDatabase(storageDirectory);
		const archiveCount = TEST_RETAINED_ARCHIVE_COUNT + 3;
		const now = createFixedDates();
		writeFileSync(path.join(backupDirectory, 'notes.txt'), 'keep me', 'utf8');

		await writeLatestBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory,
			naming: TEST_BACKUP_NAMING
		});

		const archivePaths: string[] = [];

		for(let index = 0; index < archiveCount; index++) {
			archivePaths.push(await writeArchiveBackup({
				backupDirectory,
				naming: TEST_BACKUP_NAMING,
				retainedArchiveCount: TEST_RETAINED_ARCHIVE_COUNT,
				now
			}));
		}

		const remainingArchives = await readArchiveBackupFileNames(TEST_BACKUP_NAMING, backupDirectory);

		expect(remainingArchives).toEqual(archivePaths.slice(-TEST_RETAINED_ARCHIVE_COUNT).map((archivePath) => {
			return path.basename(archivePath);
		}));
		expect(readdirSync(backupDirectory)).toContain('notes.txt');

		// The rotation may never take the one copy that always holds the newest state
		expect(await latestBackupExists(TEST_BACKUP_NAMING, backupDirectory)).toBe(true);
	});

	// Shutdown can abandon a copy halfway through, and the file it leaves behind must not pile up
	test('clears a partial copy left behind by an interrupted backup', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = makeTempDirectory();
		const database = openTrackedDatabase(storageDirectory);
		const abandonedPartialPath = path.join(
			backupDirectory,
			`${createArchiveBackupFileName(TEST_BACKUP_NAMING, new Date('2026-06-06T09:00:00.000Z'))}${TEST_BACKUP_NAMING.partialFileExtension}`
		);
		writeFileSync(abandonedPartialPath, 'half a database', 'utf8');

		await writeLatestBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory,
			naming: TEST_BACKUP_NAMING
		});

		expect(existsSync(abandonedPartialPath)).toBe(false);
		expect(await readArchiveBackupFileNames(TEST_BACKUP_NAMING, backupDirectory)).toEqual([]);
	});

	test('fails without leaving a partial copy when the backup folder cannot be written', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = path.join(makeTempDirectory(), 'blocked');
		writeFileSync(backupDirectory, 'not a folder', 'utf8');
		const database = openTrackedDatabase(storageDirectory);

		await expect(writeLatestBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory,
			naming: TEST_BACKUP_NAMING
		})).rejects.toThrow();

		expect(existsSync(path.join(storageDirectory, TEST_BACKUP_NAMING.temporaryFileName))).toBe(false);
	});
});
