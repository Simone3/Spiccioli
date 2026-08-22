import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRetryingFileWriter, withTimeout, type CreateRetryingFileWriterOptions, type ExternalModification, type FileWriteAttemptFailure } from 'src/framework/main/storage/RetryingFileWriter';
import { hashFileContents } from 'src/framework/main/storage/WholeFileStorage';

const MAXIMUM_ATTEMPTS = 5;

const RETRY_DELAY_MS = 3000;

const tempDirectories: string[] = [];

const makeTempDirectory = (): string => {
	const directory = mkdtempSync(path.join(tmpdir(), 'retrying-file-writer-'));
	tempDirectories.push(directory);

	return directory;
};

// Nothing here waits in real time: the delay is recorded and returns at once, so five spaced attempts run in one tick
const makeWriter = (filePath: string, overrides: Partial<CreateRetryingFileWriterOptions> = {}): {
	writer: ReturnType<typeof createRetryingFileWriter>;
	failures: FileWriteAttemptFailure[];
	modifications: ExternalModification[];
	delays: number[];
} => {
	const failures: FileWriteAttemptFailure[] = [];
	const modifications: ExternalModification[] = [];
	const delays: number[] = [];

	const writer = createRetryingFileWriter({
		filePath,
		temporaryFilePath: `${filePath}.saving`,
		maximumAttempts: MAXIMUM_ATTEMPTS,
		retryDelayMs: RETRY_DELAY_MS,
		writeTimeoutMs: 10000,
		writeTimeoutMessage: 'The write did not finish in time.',
		onAttemptFailed: (failure) => {
			failures.push(failure);
		},
		onExternalModification: (modification) => {
			modifications.push(modification);
		},
		delay: (durationMs) => {
			delays.push(durationMs);

			return Promise.resolve();
		},
		...overrides
	});

	return { writer, failures, modifications, delays };
};

afterEach(() => {
	while(tempDirectories.length > 0) {
		rmSync(tempDirectories.pop() as string, { recursive: true, force: true });
	}
});

describe('writing', () => {
	test('writes on the first attempt and records what it wrote', async() => {
		const filePath = path.join(makeTempDirectory(), 'document.json');
		const { writer, failures } = makeWriter(filePath);

		const outcome = await writer.write('hello');

		expect(outcome.ok).toBe(true);
		expect(outcome.attempts).toBe(1);
		expect(readFileSync(filePath, 'utf8')).toBe('hello');
		expect(writer.getRecordedHash()).toBe(hashFileContents('hello'));
		expect(failures).toEqual([]);
	});
});

describe('the spaced retries', () => {
	test('gives up after the fixed number of attempts and reports every one of them', async() => {
		const directory = makeTempDirectory();

		// A path whose parent is a file rather than a folder fails every time, which is the shape of a failure that never clears
		writeFileSync(path.join(directory, 'occupied'), '', 'utf8');

		const filePath = path.join(directory, 'occupied', 'document.json');
		const { writer, failures, delays } = makeWriter(filePath);

		const outcome = await writer.write('hello');

		expect(outcome.ok).toBe(false);
		expect(outcome.attempts).toBe(MAXIMUM_ATTEMPTS);
		expect(failures).toHaveLength(MAXIMUM_ATTEMPTS);
		expect(failures.map((failure) => {
			return failure.attempt;
		})).toEqual([ 1, 2, 3, 4, 5 ]);

		// Spaced between attempts, and no wait after the last one
		expect(delays).toEqual([ RETRY_DELAY_MS, RETRY_DELAY_MS, RETRY_DELAY_MS, RETRY_DELAY_MS ]);
		expect(failures[MAXIMUM_ATTEMPTS - 1].nextAttemptInMs).toBeUndefined();
	});

	test('stops waiting for a write that never finishes, in the wording the application gave it', async() => {
		const neverSettles = new Promise<void>(() => {
			return undefined;
		});

		await expect(withTimeout(neverSettles, 1, 'The write did not finish in time.')).rejects.toThrow('The write did not finish in time.');
	});

	test('lets an operation that finishes in time through untouched', async() => {
		expect(await withTimeout(Promise.resolve('written'), 10000, 'The write did not finish in time.')).toBe('written');
	});
});

describe('external modification', () => {
	test('says nothing about a file nothing has read yet', async() => {
		const filePath = path.join(makeTempDirectory(), 'document.json');
		const { writer, modifications } = makeWriter(filePath);

		await writer.write('first');

		expect(modifications).toEqual([]);
	});

	test('says nothing when the file is still the one that was written', async() => {
		const filePath = path.join(makeTempDirectory(), 'document.json');
		const { writer, modifications } = makeWriter(filePath);

		await writer.write('first');
		await writer.write('second');

		expect(modifications).toEqual([]);
		expect(readFileSync(filePath, 'utf8')).toBe('second');
	});

	test('offers the displaced bytes before overwriting them, and carries on', async() => {
		const filePath = path.join(makeTempDirectory(), 'document.json');
		const { writer, modifications } = makeWriter(filePath);

		await writer.write('first');
		writeFileSync(filePath, 'something else wrote this', 'utf8');

		const outcome = await writer.write('second');

		expect(outcome.ok).toBe(true);
		expect(modifications).toHaveLength(1);
		expect(modifications[0].displacedContents).toBe('something else wrote this');
		expect(modifications[0].recordedHash).toBe(hashFileContents('first'));
		expect(modifications[0].foundHash).toBe(hashFileContents('something else wrote this'));
		expect(readFileSync(filePath, 'utf8')).toBe('second');
	});

	/**
	 * A failing write has five attempts and the file is still modified at every one of them, so reporting it per attempt handed
	 * the same displaced version over five times. Where the application keeps those copies to a count, four of them would be
	 * spent pushing four real ones out of the rotation.
	 */
	test('hands one displaced version over once, however many attempts the write takes', async() => {
		const directory = makeTempDirectory();
		const filePath = path.join(directory, 'document.json');
		const { writer, modifications, failures } = makeWriter(filePath, {
			// A directory cannot be renamed onto, so every attempt fails for a reason that has nothing to do with the modification
			temporaryFilePath: directory
		});

		writeFileSync(filePath, 'mine', 'utf8');
		writer.recordHash(hashFileContents('mine'));
		writeFileSync(filePath, 'something else wrote this', 'utf8');

		const outcome = await writer.write('second');

		expect(outcome.ok).toBe(false);
		expect(failures).toHaveLength(MAXIMUM_ATTEMPTS);
		expect(modifications).toHaveLength(1);
		expect(modifications[0].displacedContents).toBe('something else wrote this');
	});

	test('hands a second modification over even after one has been reported', async() => {
		const filePath = path.join(makeTempDirectory(), 'document.json');
		const { writer, modifications } = makeWriter(filePath);

		await writer.write('first');
		writeFileSync(filePath, 'the first intrusion', 'utf8');
		await writer.write('second');

		writeFileSync(filePath, 'the second intrusion', 'utf8');
		await writer.write('third');

		expect(modifications).toHaveLength(2);
		expect(modifications[1].displacedContents).toBe('the second intrusion');
	});

	test('reports a file that was deleted rather than changed, with nothing to displace', async() => {
		const directory = makeTempDirectory();
		const filePath = path.join(directory, 'document.json');
		const { writer, modifications } = makeWriter(filePath);

		await writer.write('first');
		rmSync(filePath);

		const outcome = await writer.write('second');

		expect(outcome.ok).toBe(true);
		expect(modifications).toHaveLength(1);
		expect(modifications[0].displacedContents).toBeUndefined();
		expect(modifications[0].foundHash).toBeUndefined();
	});

	test('compares against what was read, not only against what was written', async() => {
		const filePath = path.join(makeTempDirectory(), 'document.json');
		writeFileSync(filePath, 'what was on disk', 'utf8');

		const { writer, modifications } = makeWriter(filePath);
		writer.recordHash(hashFileContents('what was on disk'));

		await writer.write('mine');
		expect(modifications).toEqual([]);

		writeFileSync(filePath, 'and now somebody else', 'utf8');
		await writer.write('mine again');
		expect(modifications).toHaveLength(1);
	});
});
