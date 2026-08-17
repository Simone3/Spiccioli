import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { hashFileContents, readWholeFile, readWholeFileIfPresent, writeWholeFileAtomically } from 'src/framework/main/storage/WholeFileStorage';

const tempDirectories: string[] = [];

const makeTempDirectory = (): string => {
	const directory = mkdtempSync(path.join(tmpdir(), 'whole-file-storage-'));
	tempDirectories.push(directory);

	return directory;
};

afterEach(() => {
	while(tempDirectories.length > 0) {
		rmSync(tempDirectories.pop() as string, { recursive: true, force: true });
	}
});

describe('hashFileContents', () => {
	test('gives the same fingerprint to the same bytes and a different one to anything else', () => {
		expect(hashFileContents('a')).toBe(hashFileContents('a'));
		expect(hashFileContents('a')).not.toBe(hashFileContents('b'));
	});
});

describe('readWholeFile', () => {
	test('reads the contents, the size and the fingerprint', async() => {
		const directory = makeTempDirectory();
		const filePath = path.join(directory, 'document.json');
		writeFileSync(filePath, '{ "a": 1 }', 'utf8');

		const file = await readWholeFile(filePath);

		expect(file.contents).toBe('{ "a": 1 }');
		expect(file.sizeBytes).toBe(10);
		expect(file.hash).toBe(hashFileContents('{ "a": 1 }'));
	});

	test('throws for a file that is not there', async() => {
		await expect(readWholeFile(path.join(makeTempDirectory(), 'missing.json'))).rejects.toThrow();
	});

	test('reads a missing file as nothing when that is a legitimate answer', async() => {
		expect(await readWholeFileIfPresent(path.join(makeTempDirectory(), 'missing.json'))).toBeUndefined();
	});
});

describe('writeWholeFileAtomically', () => {
	test('writes the file and leaves no temporary file behind', async() => {
		const directory = makeTempDirectory();
		const filePath = path.join(directory, 'document.json');

		const result = await writeWholeFileAtomically({
			filePath,
			temporaryFilePath: `${filePath}.saving`,
			contents: 'hello'
		});

		expect(readFileSync(filePath, 'utf8')).toBe('hello');
		expect(readdirSync(directory)).toEqual([ 'document.json' ]);
		expect(result.hash).toBe(hashFileContents('hello'));
		expect(result.sizeBytes).toBe(5);
	});

	test('replaces what was there rather than appending to it', async() => {
		const directory = makeTempDirectory();
		const filePath = path.join(directory, 'document.json');
		writeFileSync(filePath, 'the old contents, which are longer', 'utf8');

		await writeWholeFileAtomically({
			filePath,
			temporaryFilePath: `${filePath}.saving`,
			contents: 'short'
		});

		expect(readFileSync(filePath, 'utf8')).toBe('short');
	});

	test('creates the directory the file goes in', async() => {
		const filePath = path.join(makeTempDirectory(), 'nested', 'document.json');

		await writeWholeFileAtomically({
			filePath,
			temporaryFilePath: `${filePath}.saving`,
			contents: 'hello'
		});

		expect(readFileSync(filePath, 'utf8')).toBe('hello');
	});

	test('leaves the previous file untouched and removes the temporary one when the write fails', async() => {
		const directory = makeTempDirectory();
		const filePath = path.join(directory, 'document.json');
		writeFileSync(filePath, 'the previous contents', 'utf8');

		// A directory cannot be written to as a file, which is a write failure without having to break the filesystem
		const temporaryFilePath = path.join(directory, 'busy');
		writeFileSync(path.join(directory, 'placeholder'), '', 'utf8');

		await expect(writeWholeFileAtomically({
			filePath,
			temporaryFilePath: path.join(temporaryFilePath, 'nowhere', 'deeper.tmp'),
			contents: 'the new contents'
		})).rejects.toThrow();

		expect(readFileSync(filePath, 'utf8')).toBe('the previous contents');
		expect(existsSync(path.join(temporaryFilePath, 'nowhere', 'deeper.tmp'))).toBe(false);
	});
});
