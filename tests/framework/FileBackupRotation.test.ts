import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeBackupCopy } from 'src/framework/main/storage/FileBackupRotation';

const RETAINED_COUNT = 3;

const tempDirectories: string[] = [];

const makeTempDirectory = (): string => {
	const directory = mkdtempSync(path.join(tmpdir(), 'file-backup-rotation-'));
	tempDirectories.push(directory);

	return directory;
};

// The names sort chronologically, which is what makes "oldest" a sort rather than a stat of every file in the folder
const isBackupFileName = (fileName: string): boolean => {
	return /^copy-\d{3}\.json$/.test(fileName);
};

const writeCopy = (backupDirectory: string, index: number): ReturnType<typeof writeBackupCopy> => {
	return writeBackupCopy({
		backupDirectory,
		backupFileName: `copy-${String(index).padStart(3, '0')}.json`,
		contents: `contents ${index}`,
		retainedCount: RETAINED_COUNT,
		isBackupFileName,
		temporaryFileSuffix: '.saving'
	});
};

afterEach(() => {
	while(tempDirectories.length > 0) {
		rmSync(tempDirectories.pop() as string, { recursive: true, force: true });
	}
});

describe('writeBackupCopy', () => {
	test('creates the folder and writes the copy into it', async() => {
		const backupDirectory = path.join(makeTempDirectory(), 'finances-backups');

		const result = await writeCopy(backupDirectory, 1);

		expect(readFileSync(result.backupPath, 'utf8')).toBe('contents 1');
		expect(result.retainedCount).toBe(1);
		expect(result.rotatedOutFileNames).toEqual([]);
		expect(readdirSync(backupDirectory)).toEqual([ 'copy-001.json' ]);
	});

	test('keeps every copy until the folder is full', async() => {
		const backupDirectory = path.join(makeTempDirectory(), 'finances-backups');

		await writeCopy(backupDirectory, 1);
		await writeCopy(backupDirectory, 2);

		const result = await writeCopy(backupDirectory, 3);

		expect(result.retainedCount).toBe(RETAINED_COUNT);
		expect(result.rotatedOutFileNames).toEqual([]);
		expect(readdirSync(backupDirectory)).toHaveLength(RETAINED_COUNT);
	});

	test('the copy that would take the folder past the count is what removes the oldest', async() => {
		const backupDirectory = path.join(makeTempDirectory(), 'finances-backups');

		await writeCopy(backupDirectory, 1);
		await writeCopy(backupDirectory, 2);
		await writeCopy(backupDirectory, 3);

		const result = await writeCopy(backupDirectory, 4);

		expect(result.rotatedOutFileNames).toEqual([ 'copy-001.json' ]);
		expect(result.retainedCount).toBe(RETAINED_COUNT);
		expect(readdirSync(backupDirectory).sort()).toEqual([ 'copy-002.json', 'copy-003.json', 'copy-004.json' ]);
	});

	test('comes down to a lowered count over the next few copies rather than all at once', async() => {
		const backupDirectory = path.join(makeTempDirectory(), 'finances-backups');

		await writeCopy(backupDirectory, 1);
		await writeCopy(backupDirectory, 2);
		await writeCopy(backupDirectory, 3);

		const result = await writeBackupCopy({
			backupDirectory,
			backupFileName: 'copy-004.json',
			contents: 'contents 4',
			retainedCount: 2,
			isBackupFileName,
			temporaryFileSuffix: '.saving'
		});

		// Four copies and a count of two: this one write removes what it has to and no more
		expect(result.rotatedOutFileNames).toEqual([ 'copy-001.json', 'copy-002.json' ]);
		expect(result.retainedCount).toBe(2);
	});

	test('leaves alone anything in the folder that is not one of its copies', async() => {
		const backupDirectory = makeTempDirectory();
		writeFileSync(path.join(backupDirectory, 'notes.txt'), 'mine', 'utf8');

		await writeCopy(backupDirectory, 1);
		await writeCopy(backupDirectory, 2);
		await writeCopy(backupDirectory, 3);
		await writeCopy(backupDirectory, 4);

		expect(readdirSync(backupDirectory).sort()).toEqual([ 'copy-002.json', 'copy-003.json', 'copy-004.json', 'notes.txt' ]);
	});
});
