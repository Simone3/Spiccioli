import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * The sample bank exports, built the way somebody would build them by hand.
 *
 * `scripts/write-sample-imports.js` is run as a script rather than required as a module, so that its entry point is exercised
 * too — the same thing `FileFormat.test.ts` does with the sample ledger, and for the same reason: a script nobody runs is a
 * script that has stopped working without anybody hearing about it.
 */

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..');

const SAMPLE_IMPORTS_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'write-sample-imports.js');

// The file each template's export is written to, which is what the script names them
const SAMPLE_FILE_NAMES: Record<string, string> = {
	isybank: 'isybank.xlsx',
	ing: 'ing.xlsx',
	directa: 'directa.xlsx',
	edenred: 'edenred.xlsx',
	'trade-republic': 'trade-republic.csv'
};

/**
 * Builds one sample export and hands back its bytes.
 * @param id The template whose export is wanted.
 * @returns The file's bytes.
 */
export const buildSampleImport = (id: string): Buffer => {
	const fileName = SAMPLE_FILE_NAMES[id];

	if(fileName === undefined) {
		throw new Error(`No sample export is written for "${id}"`);
	}

	const directory = mkdtempSync(path.join(tmpdir(), 'spiccioli-sample-imports-'));

	try {
		execFileSync(process.execPath, [ SAMPLE_IMPORTS_SCRIPT, directory ], { stdio: 'pipe' });

		return readFileSync(path.join(directory, fileName));
	}
	finally {
		rmSync(directory, { force: true, recursive: true });
	}
};
