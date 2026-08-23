import path from 'node:path';
import { LEDGER_FILE_CONFIG } from 'src/config/AppConfig';
import { findLedgerFileArgument } from 'src/main/startup/LedgerFileArguments';

/**
 * The ledger a launch was asked to open, off its command line.
 *
 * What is worth testing here is everything that is *not* the file: a packaged launch and a development one count their arguments
 * differently, Chromium and Electron both leave switches on the line, and a second launch is started from a directory that is not
 * this process's own.
 */

const LEDGER = `finances${LEDGER_FILE_CONFIG.extension}`;

describe('LedgerFileArguments', () => {
	test('reads the ledger a packaged launch was started with', () => {
		expect(findLedgerFileArgument({
			argv: [ '/Applications/Spiccioli.app/Contents/MacOS/Spiccioli', `/Documents/${LEDGER}` ],
			isPackaged: true,
			workingDirectory: '/'
		})).toBe(`/Documents/${LEDGER}`);
	});

	test('skips the project directory a development run is started on', () => {
		expect(findLedgerFileArgument({
			argv: [ '/node_modules/electron/dist/electron', '/project', `/Documents/${LEDGER}` ],
			isPackaged: false,
			workingDirectory: '/'
		})).toBe(`/Documents/${LEDGER}`);
	});

	test('resolves a relative path against the directory the launch came from', () => {
		expect(findLedgerFileArgument({
			argv: [ 'Spiccioli', LEDGER ],
			isPackaged: true,
			workingDirectory: '/home/user/ledgers'
		})).toBe(path.join('/home/user/ledgers', LEDGER));
	});

	test('ignores the switches Chromium and Electron leave on the command line', () => {
		expect(findLedgerFileArgument({
			argv: [ 'Spiccioli', '--allow-file-access-from-files', `--trace=${LEDGER}`, `/Documents/${LEDGER}` ],
			isPackaged: true,
			workingDirectory: '/'
		})).toBe(`/Documents/${LEDGER}`);
	});

	test('reads the extension whatever case it is written in', () => {
		const shouted = `/Documents/FINANCES${LEDGER_FILE_CONFIG.extension.toUpperCase()}`;

		expect(findLedgerFileArgument({
			argv: [ 'Spiccioli', shouted ],
			isPackaged: true,
			workingDirectory: '/'
		})).toBe(shouted);
	});

	test('takes the first ledger where a command line names more than one', () => {
		expect(findLedgerFileArgument({
			argv: [ 'Spiccioli', `/Documents/${LEDGER}`, `/Documents/other${LEDGER_FILE_CONFIG.extension}` ],
			isPackaged: true,
			workingDirectory: '/'
		})).toBe(`/Documents/${LEDGER}`);
	});

	test('finds nothing where an argument is not a ledger', () => {
		expect(findLedgerFileArgument({
			argv: [ 'Spiccioli', '/Documents/finances.json', '/Documents/finances' ],
			isPackaged: true,
			workingDirectory: '/'
		})).toBeUndefined();
	});

	test('finds nothing on a command line that names nothing at all', () => {
		expect(findLedgerFileArgument({
			argv: [ 'Spiccioli' ],
			isPackaged: true,
			workingDirectory: '/'
		})).toBeUndefined();
	});
});
