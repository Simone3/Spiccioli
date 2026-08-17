import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { makeTranslator } from '../testUtils';
import { LEDGER_FILE_CONFIG } from 'src/config/AppConfig';
import { resetAppLoggerForTests } from 'src/framework/main/logging/AppLogger';
import { createLedgerSession, type LedgerSession } from 'src/main/storage/LedgerSession';
import type { LedgerExternalModificationEvent, LedgerWriteAttemptFailedEvent } from 'src/types/LedgerIpcTypes';

const BACKUP_COUNT = 3;

const tempDirectories: string[] = [];

const makeTempDirectory = (): string => {
	const directory = mkdtempSync(path.join(tmpdir(), 'ledger-session-'));
	tempDirectories.push(directory);

	return directory;
};

interface SessionHarness {
	session: LedgerSession;
	ledgerPath: string;
	backupDirectory: string;
	rememberedFiles: string[];
	attemptFailures: LedgerWriteAttemptFailedEvent[];
	externalModifications: LedgerExternalModificationEvent[];
	moment: { value: Date };
}

const makeSession = (directory = makeTempDirectory()): SessionHarness => {
	const rememberedFiles: string[] = [];
	const attemptFailures: LedgerWriteAttemptFailedEvent[] = [];
	const externalModifications: LedgerExternalModificationEvent[] = [];

	// Every copy would otherwise be named for the same millisecond, and the second one would land on the first
	const moment = { value: new Date(2026, 7, 8, 14, 32, 7, 100) };

	const session = createLedgerSession({
		translator: makeTranslator(),
		readBackupCount: () => {
			return BACKUP_COUNT;
		},
		rememberRecentFile: (filePath) => {
			rememberedFiles.push(filePath);
		},
		onWriteAttemptFailed: (event) => {
			attemptFailures.push(event);
		},
		onExternalModification: (event) => {
			externalModifications.push(event);
		},
		now: () => {
			moment.value = new Date(moment.value.getTime() + 1);

			return moment.value;
		},
		delay: () => {
			return Promise.resolve();
		}
	});

	return {
		session,
		ledgerPath: path.join(directory, `finances${LEDGER_FILE_CONFIG.extension}`),
		backupDirectory: path.join(directory, 'finances-backups'),
		rememberedFiles,
		attemptFailures,
		externalModifications,
		moment
	};
};

beforeEach(() => {
	resetAppLoggerForTests();
});

afterEach(() => {
	while(tempDirectories.length > 0) {
		rmSync(tempDirectories.pop() as string, { recursive: true, force: true });
	}
});

describe('creating a file', () => {
	test('writes it where the location was chosen and remembers it', async() => {
		const { session, ledgerPath, rememberedFiles } = makeSession();

		const result = await session.createFile({ filePath: ledgerPath, contents: '{"schemaVersion":1}', schemaVersion: 1 });

		expect(result.ok).toBe(true);
		expect(readFileSync(ledgerPath, 'utf8')).toBe('{"schemaVersion":1}');
		expect(session.getOpenFilePath()).toBe(ledgerPath);
		expect(rememberedFiles).toEqual([ ledgerPath ]);
	});

	test('leaves nothing open when it could not be written', async() => {
		const directory = makeTempDirectory();
		writeFileSync(path.join(directory, 'occupied'), '', 'utf8');

		const { session } = makeSession(directory);
		const result = await session.createFile({
			filePath: path.join(directory, 'occupied', 'finances.spiccioli'),
			contents: '{}',
			schemaVersion: 1
		});

		expect(result.ok).toBe(false);
		expect(session.getOpenFilePath()).toBeUndefined();
	});
});

describe('reading and accepting a file', () => {
	test('hands the contents over and makes the file the open one once it has been parsed', async() => {
		const { session, ledgerPath, rememberedFiles } = makeSession();
		writeFileSync(ledgerPath, '{"schemaVersion":1}', 'utf8');

		const read = await session.readFile(ledgerPath);

		expect(read.outcome).toBe('read');
		expect(session.getOpenFilePath()).toBeUndefined();

		session.acceptFile({
			filePath: ledgerPath,
			schemaVersion: 1,
			recordCounts: {
				institutions: 0,
				accounts: 0,
				securities: 0,
				prices: 0,
				transactions: 0,
				trades: 0,
				contracts: 0,
				contractYears: 0,
				payslips: 0,
				categories: 27,
				rules: 0
			},
			parseDurationMs: 3
		});

		expect(session.getOpenFilePath()).toBe(ledgerPath);
		expect(rememberedFiles).toEqual([ ledgerPath ]);
	});

	test('reports a file it could not read and opens nothing', async() => {
		const { session, ledgerPath } = makeSession();

		const read = await session.readFile(ledgerPath);

		expect(read.outcome).toBe('unreadable');
		expect(session.getOpenFilePath()).toBeUndefined();
	});

	test('a refused file leaves nothing open and nothing remembered', async() => {
		const { session, ledgerPath, rememberedFiles } = makeSession();
		writeFileSync(ledgerPath, 'not a ledger', 'utf8');

		await session.readFile(ledgerPath);
		session.rejectFile({ filePath: ledgerPath, refusal: { reason: 'malformed-json' } });

		expect(session.getOpenFilePath()).toBeUndefined();
		expect(rememberedFiles).toEqual([]);
	});
});

describe('saving', () => {
	test('refuses to save when no file is open', async() => {
		const { session } = makeSession();

		expect((await session.save('{}')).ok).toBe(false);
	});

	test('writes the whole file every time', async() => {
		const { session, ledgerPath } = makeSession();
		await session.createFile({ filePath: ledgerPath, contents: 'first', schemaVersion: 1 });

		expect((await session.save('second')).ok).toBe(true);
		expect(readFileSync(ledgerPath, 'utf8')).toBe('second');
	});

	test('leaves no temporary file behind', async() => {
		const { session, ledgerPath } = makeSession();
		await session.createFile({ filePath: ledgerPath, contents: 'first', schemaVersion: 1 });
		await session.save('second');

		expect(existsSync(`${ledgerPath}${LEDGER_FILE_CONFIG.temporaryFileSuffix}`)).toBe(false);
	});
});

describe('external modification', () => {
	test('copies the displaced version into the backup folder and carries on', async() => {
		const { session, ledgerPath, backupDirectory, externalModifications } = makeSession();
		await session.createFile({ filePath: ledgerPath, contents: 'mine', schemaVersion: 1 });

		writeFileSync(ledgerPath, 'something else wrote this', 'utf8');

		expect((await session.save('mine again')).ok).toBe(true);
		expect(readFileSync(ledgerPath, 'utf8')).toBe('mine again');
		expect(externalModifications).toHaveLength(1);

		const event = externalModifications[0];

		expect(event.backup.written).toBe(true);
		expect(event.backup.backupFileName).toContain('-external');
		expect(readFileSync(path.join(backupDirectory, event.backup.backupFileName as string), 'utf8')).toBe('something else wrote this');
	});

	test('says how many copies the folder holds, which is what the sentence interpolates', async() => {
		const { session, ledgerPath, externalModifications } = makeSession();
		await session.createFile({ filePath: ledgerPath, contents: 'mine', schemaVersion: 1 });
		writeFileSync(ledgerPath, 'displaced', 'utf8');
		await session.save('mine again');

		expect(externalModifications[0].backup.retainedCount).toBe(1);
	});
});

describe('closing', () => {
	test('takes one copy when something was written during the session', async() => {
		const { session, ledgerPath, backupDirectory } = makeSession();
		await session.createFile({ filePath: ledgerPath, contents: 'first', schemaVersion: 1 });
		await session.save('second');

		const backup = await session.closeSession('quit');

		expect(backup.written).toBe(true);
		expect(readFileSync(path.join(backupDirectory, backup.backupFileName as string), 'utf8')).toBe('second');
		expect(session.getOpenFilePath()).toBeUndefined();
	});

	test('writes nothing for a session that only read the file', async() => {
		const { session, ledgerPath, backupDirectory } = makeSession();
		writeFileSync(ledgerPath, 'untouched', 'utf8');
		await session.readFile(ledgerPath);
		session.acceptFile({
			filePath: ledgerPath,
			schemaVersion: 1,
			recordCounts: {
				institutions: 0,
				accounts: 0,
				securities: 0,
				prices: 0,
				transactions: 0,
				trades: 0,
				contracts: 0,
				contractYears: 0,
				payslips: 0,
				categories: 27,
				rules: 0
			},
			parseDurationMs: 1
		});

		expect((await session.closeSession('window-closed')).written).toBe(false);
		expect(existsSync(backupDirectory)).toBe(false);
	});

	test('writes nothing when a file was created and never changed', async() => {
		const { session, ledgerPath, backupDirectory } = makeSession();
		await session.createFile({ filePath: ledgerPath, contents: 'seeded', schemaVersion: 1 });

		expect((await session.closeSession('new-file')).written).toBe(false);
		expect(existsSync(backupDirectory)).toBe(false);
	});

	test('rotates the oldest copy out as the copies arrive', async() => {
		const { session, ledgerPath, backupDirectory } = makeSession();

		for(let round = 0; round < BACKUP_COUNT + 1; round += 1) {
			await session.createFile({ filePath: ledgerPath, contents: `round ${round}`, schemaVersion: 1 });
			await session.save(`round ${round} changed`);
			await session.closeSession('open-file');
		}

		expect(readdirSync(backupDirectory)).toHaveLength(BACKUP_COUNT);
	});

	test('does nothing at all when no file is open', async() => {
		const { session } = makeSession();

		expect((await session.closeSession('quit')).written).toBe(false);
	});
});

describe('the upgrade', () => {
	test('copies the file as it stands before anything is written', async() => {
		const { session, ledgerPath, backupDirectory } = makeSession();
		writeFileSync(ledgerPath, 'the old shape', 'utf8');
		await session.readFile(ledgerPath);

		const backup = await session.writePreUpgradeBackup();

		expect(backup.written).toBe(true);
		expect(backup.backupFileName).toContain('-pre-upgrade');
		expect(readFileSync(path.join(backupDirectory, backup.backupFileName as string), 'utf8')).toBe('the old shape');
		expect(readFileSync(ledgerPath, 'utf8')).toBe('the old shape');
	});

	test('writes the upgraded file and makes it the open one', async() => {
		const { session, ledgerPath, rememberedFiles } = makeSession();
		writeFileSync(ledgerPath, 'the old shape', 'utf8');
		await session.readFile(ledgerPath);
		await session.writePreUpgradeBackup();

		const result = await session.completeUpgrade({
			contents: 'the new shape',
			fromSchemaVersion: 1,
			toSchemaVersion: 2,
			transactionsRecategorised: 4,
			rulesRepointed: 1,
			rulesDeleted: 0,
			categoriesRetired: 1
		});

		expect(result.ok).toBe(true);
		expect(readFileSync(ledgerPath, 'utf8')).toBe('the new shape');
		expect(session.getOpenFilePath()).toBe(ledgerPath);
		expect(rememberedFiles).toEqual([ ledgerPath ]);
	});

	test('has nothing to back up when no file has been read', async() => {
		const { session } = makeSession();

		expect((await session.writePreUpgradeBackup()).written).toBe(false);
	});
});
