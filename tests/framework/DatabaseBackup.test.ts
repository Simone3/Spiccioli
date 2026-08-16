import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resetAppLoggerForTests } from 'src/framework/main/logging/AppLogger';
import { openAppDatabase, type AppDatabase, type DatabaseMigration } from 'src/framework/main/storage/AppDatabase';
import { createBackupFileName, createDatabaseBackup, isBackupFileName, readBackupFileNames } from 'src/framework/main/storage/DatabaseBackup';
import type { BackupFileNaming } from 'src/framework/types/BackupTypes';

const TEST_BACKUP_NAMING: BackupFileNaming = {
	filePrefix: 'test-backup-',
	fileExtension: '.sqlite',
	partialFileExtension: '.part',
	temporaryFileName: 'test-backup.tmp.sqlite'
};

const TEST_RETAINED_BACKUP_COUNT = 5;

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

	test('names backups so that they sort chronologically', () => {
		const older = createBackupFileName(TEST_BACKUP_NAMING, new Date('2026-06-06T09:30:00.000Z'));
		const newer = createBackupFileName(TEST_BACKUP_NAMING, new Date('2026-06-06T10:00:00.000Z'));

		expect(isBackupFileName(TEST_BACKUP_NAMING, older)).toBe(true);
		expect([ newer, older ].sort()).toEqual([ older, newer ]);
		expect(isBackupFileName(TEST_BACKUP_NAMING, TEST_BACKUP_NAMING.temporaryFileName)).toBe(false);
		expect(isBackupFileName(TEST_BACKUP_NAMING, `${older}${TEST_BACKUP_NAMING.partialFileExtension}`)).toBe(false);
	});

	test('writes a complete database copy and leaves no temporary file behind', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = makeTempDirectory();
		const database = openTrackedDatabase(storageDirectory);

		const backupPath = await createDatabaseBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory,
			naming: TEST_BACKUP_NAMING,
			retainedBackupCount: TEST_RETAINED_BACKUP_COUNT
		});

		expect(existsSync(backupPath)).toBe(true);
		expect(existsSync(path.join(storageDirectory, TEST_BACKUP_NAMING.temporaryFileName))).toBe(false);
		expect(await readBackupFileNames(TEST_BACKUP_NAMING, backupDirectory)).toEqual([ path.basename(backupPath) ]);

		// A copy that cannot be opened as a database would be worthless as a backup
		const restoredDirectory = makeTempDirectory();
		copyFileSync(backupPath, path.join(restoredDirectory, TEST_DATABASE_FILE_NAME));

		expect(openTrackedDatabase(restoredDirectory).getAppliedMigrationVersions()).toEqual([ TEST_SCHEMA_VERSION ]);
	});

	test('creates the backup folder when it does not exist yet', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = path.join(makeTempDirectory(), 'nested', 'backups');
		const database = openTrackedDatabase(storageDirectory);

		await createDatabaseBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory,
			naming: TEST_BACKUP_NAMING,
			retainedBackupCount: TEST_RETAINED_BACKUP_COUNT
		});

		expect(await readBackupFileNames(TEST_BACKUP_NAMING, backupDirectory)).toHaveLength(1);
	});

	test('keeps only the most recent backups and leaves other files alone', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = makeTempDirectory();
		const database = openTrackedDatabase(storageDirectory);
		const backupCount = TEST_RETAINED_BACKUP_COUNT + 3;
		const now = createFixedDates();
		writeFileSync(path.join(backupDirectory, 'notes.txt'), 'keep me', 'utf8');

		const backupPaths: string[] = [];

		for(let index = 0; index < backupCount; index++) {
			backupPaths.push(await createDatabaseBackup({
				database,
				backupDirectory,
				temporaryDirectory: storageDirectory,
				naming: TEST_BACKUP_NAMING,
				retainedBackupCount: TEST_RETAINED_BACKUP_COUNT,
				now
			}));
		}

		const remainingBackups = await readBackupFileNames(TEST_BACKUP_NAMING, backupDirectory);

		expect(remainingBackups).toEqual(backupPaths.slice(-TEST_RETAINED_BACKUP_COUNT).map((backupPath) => {
			return path.basename(backupPath);
		}));
		expect(readdirSync(backupDirectory)).toContain('notes.txt');
	});

	// Shutdown can abandon a backup halfway through, and the file it leaves behind must not pile up
	test('clears a partial copy left behind by an interrupted backup', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = makeTempDirectory();
		const database = openTrackedDatabase(storageDirectory);
		const abandonedPartialPath = path.join(
			backupDirectory,
			`${createBackupFileName(TEST_BACKUP_NAMING, new Date('2026-06-06T09:00:00.000Z'))}${TEST_BACKUP_NAMING.partialFileExtension}`
		);
		writeFileSync(abandonedPartialPath, 'half a database', 'utf8');

		await createDatabaseBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory,
			naming: TEST_BACKUP_NAMING,
			retainedBackupCount: TEST_RETAINED_BACKUP_COUNT
		});

		expect(existsSync(abandonedPartialPath)).toBe(false);
		expect(await readBackupFileNames(TEST_BACKUP_NAMING, backupDirectory)).toHaveLength(1);
	});

	test('fails without leaving a partial copy when the backup folder cannot be written', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = path.join(makeTempDirectory(), 'blocked');
		writeFileSync(backupDirectory, 'not a folder', 'utf8');
		const database = openTrackedDatabase(storageDirectory);

		await expect(createDatabaseBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory,
			naming: TEST_BACKUP_NAMING,
			retainedBackupCount: TEST_RETAINED_BACKUP_COUNT
		})).rejects.toThrow();

		expect(existsSync(path.join(storageDirectory, TEST_BACKUP_NAMING.temporaryFileName))).toBe(false);
	});
});
