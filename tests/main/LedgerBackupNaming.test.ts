import path from 'node:path';
import { resolveLedgerBackupNaming, resolveLedgerTemporaryFilePath } from 'src/main/storage/LedgerBackupNaming';

const LEDGER_PATH = path.join('/ledgers', 'finances.spiccioli');

const MOMENT = new Date(2026, 7, 8, 14, 32, 7, 848);

describe('the backup folder', () => {
	test('is the file\'s own name without its extension, plus "-backups", beside it', () => {
		expect(resolveLedgerBackupNaming(LEDGER_PATH).backupDirectory).toBe(path.join('/ledgers', 'finances-backups'));
	});

	test('is per file, so a second ledger in the same directory keeps its own', () => {
		const first = resolveLedgerBackupNaming(LEDGER_PATH).backupDirectory;
		const second = resolveLedgerBackupNaming(path.join('/ledgers', 'finances-2016.spiccioli')).backupDirectory;

		expect(first).not.toBe(second);
	});
});

describe('a copy\'s name', () => {
	const naming = resolveLedgerBackupNaming(LEDGER_PATH);

	test('carries the file, the moment to the millisecond, and the ledger\'s own extension', () => {
		expect(naming.createBackupFileName('close', MOMENT)).toBe('finances-2026-08-08-143207-848.spiccioli');
	});

	test('says what took it, where there is anything to say', () => {
		expect(naming.createBackupFileName('external', MOMENT)).toBe('finances-2026-08-08-143207-848-external.spiccioli');
		expect(naming.createBackupFileName('pre-upgrade', MOMENT)).toBe('finances-2026-08-08-143207-848-pre-upgrade.spiccioli');
	});

	test('cannot collide with a copy taken in the same second', () => {
		const first = naming.createBackupFileName('close', MOMENT);
		const second = naming.createBackupFileName('close', new Date(2026, 7, 8, 14, 32, 7, 849));

		expect(first).not.toBe(second);
	});

	test('sorts chronologically, which is what lets the rotation find the oldest', () => {
		const names = [
			naming.createBackupFileName('close', new Date(2026, 7, 8, 14, 32, 7, 849)),
			naming.createBackupFileName('close', new Date(2026, 0, 2, 3, 4, 5, 6)),
			naming.createBackupFileName('close', new Date(2026, 7, 8, 14, 32, 7, 848))
		];

		expect([ ...names ].sort()).toEqual([ names[1], names[2], names[0] ]);
	});
});

describe('recognising a copy', () => {
	const naming = resolveLedgerBackupNaming(LEDGER_PATH);

	test('recognises each of the three kinds', () => {
		expect(naming.isBackupFileName('finances-2026-08-08-143207-848.spiccioli')).toBe(true);
		expect(naming.isBackupFileName('finances-2026-08-08-143207-848-external.spiccioli')).toBe(true);
		expect(naming.isBackupFileName('finances-2026-08-08-143207-848-pre-upgrade.spiccioli')).toBe(true);
	});

	test('does not recognise another ledger\'s copies, or anything else in the folder', () => {
		expect(naming.isBackupFileName('finances-2016-2026-08-08-143207-848.spiccioli')).toBe(false);
		expect(naming.isBackupFileName('finances.spiccioli')).toBe(false);
		expect(naming.isBackupFileName('notes.txt')).toBe(false);
		expect(naming.isBackupFileName('finances-2026-08-08-143207-848.spiccioli.saving')).toBe(false);
	});

	test('does not recognise a name whose ledger only starts the same way', () => {
		const other = resolveLedgerBackupNaming(path.join('/ledgers', 'fin.spiccioli'));

		expect(other.isBackupFileName('finances-2026-08-08-143207-848.spiccioli')).toBe(false);
	});
});

describe('the temporary file', () => {
	test('sits in the ledger\'s own directory, so the rename stays inside one filesystem', () => {
		expect(path.dirname(resolveLedgerTemporaryFilePath(LEDGER_PATH))).toBe(path.dirname(LEDGER_PATH));
	});
});
