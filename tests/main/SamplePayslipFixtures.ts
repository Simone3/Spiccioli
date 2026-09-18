import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * The sample payslips, built the way somebody would build them by hand.
 *
 * `scripts/write-sample-payslips.js` is run as a script rather than required as a module, so that its entry point is exercised
 * too — the same thing `SampleImportFixtures.ts` does with the bank exports, and for the same reason: a script nobody runs is a
 * script that has stopped working without anybody hearing about it.
 */

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..');

const SAMPLE_PAYSLIPS_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'write-sample-payslips.js');

// The file each sample is written to, which is what the script names them
const SAMPLE_FILE_NAMES: Record<string, string> = {
	full: 'sample-payslip.pdf',
	sparse: 'sample-payslip-sparse.pdf'
};

/**
 * Builds one sample payslip and hands back its bytes.
 * @param id The sample wanted.
 * @returns The file's bytes.
 */
export const buildSamplePayslip = (id: string): Buffer => {
	const fileName = SAMPLE_FILE_NAMES[id];

	if(fileName === undefined) {
		throw new Error(`No sample payslip is written for "${id}"`);
	}

	const directory = mkdtempSync(path.join(tmpdir(), 'spiccioli-sample-payslips-'));

	try {
		execFileSync(process.execPath, [ SAMPLE_PAYSLIPS_SCRIPT, directory ], { stdio: 'pipe' });

		return readFileSync(path.join(directory, fileName));
	}
	finally {
		rmSync(directory, { force: true, recursive: true });
	}
};
