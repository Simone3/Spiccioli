import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createJsonConfigStore } from 'src/framework/main/config/JsonConfigStore';
import { resetAppLoggerForTests } from 'src/framework/main/logging/AppLogger';

/**
 * The configuration store, which treats a missing or unreadable file as a first startup.
 *
 * **That is exactly why the write has to be atomic.** A truncating write can be interrupted, and what it leaves is a file that
 * parses as nothing — which this store reads, quite correctly, as having no configuration at all. Every preference the user set
 * would be gone, and nothing would report it.
 */

interface StoredConfig {
	name: string;
	count: number;
}

const DEFAULTS: StoredConfig = { name: '', count: 0 };

const tempDirectories: string[] = [];

const makeConfigFilePath = (): string => {
	const directory = mkdtempSync(path.join(tmpdir(), 'json-config-'));
	tempDirectories.push(directory);

	return path.join(directory, 'config.json');
};

const parse = (content: unknown): StoredConfig => {
	const record = typeof content === 'object' && content !== null ? content as Record<string, unknown> : {};

	return {
		name: typeof record.name === 'string' ? record.name : DEFAULTS.name,
		count: typeof record.count === 'number' ? record.count : DEFAULTS.count
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

describe('the configuration store', () => {
	test('reads back what it wrote', () => {
		const filePath = makeConfigFilePath();
		const store = createJsonConfigStore({ filePath, parse });

		store.write({ name: 'finances', count: 3 });

		expect(store.read()).toEqual({ name: 'finances', count: 3 });
	});

	test('reads a file that is not there as a first startup', () => {
		const store = createJsonConfigStore({ filePath: makeConfigFilePath(), parse });

		expect(store.read()).toEqual(DEFAULTS);
	});

	test('reads a corrupted file as a first startup rather than failing', () => {
		const filePath = makeConfigFilePath();
		writeFileSync(filePath, '{ this is not json', 'utf8');

		expect(createJsonConfigStore({ filePath, parse }).read()).toEqual(DEFAULTS);
	});

	test('leaves no temporary file beside the configuration', () => {
		const filePath = makeConfigFilePath();
		const store = createJsonConfigStore({ filePath, parse });

		store.write({ name: 'finances', count: 3 });

		expect(readdirSync(path.dirname(filePath))).toEqual([ path.basename(filePath) ]);
	});

	/**
	 * A write that cannot land leaves what was already stored, rather than the emptiness a truncated one would read as.
	 * The temporary file is made unwritable here, which is the half of the write that happens before anything reaches the
	 * configuration itself — the same shape as a disk that filled up partway through.
	 */
	test('keeps the configuration that was there when a write could not be made', () => {
		const filePath = makeConfigFilePath();
		const store = createJsonConfigStore({ filePath, parse });
		store.write({ name: 'finances', count: 3 });

		// Nothing can be written over a directory
		mkdirSync(`${filePath}.${process.pid}.tmp`);

		store.write({ name: 'other', count: 9 });

		expect(store.read()).toEqual({ name: 'finances', count: 3 });
		expect(readFileSync(filePath, 'utf8')).toContain('finances');
	});
});
