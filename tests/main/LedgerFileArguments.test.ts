import path from 'node:path';
import { LEDGER_FILE_CONFIG } from 'src/config/AppConfig';
import { findLedgerFileArgument } from 'src/main/startup/LedgerFileArguments';

/**
 * The ledger a launch was asked to open, off its command line.
 *
 * What is worth testing here is everything that is *not* the file: a packaged launch and a development one count their arguments
 * differently, Chromium and Electron both leave switches on the line, and a second launch is started from a directory that is not
 * this process's own.
 *
 * **Every expectation is resolved by the host rather than written out**, because making an absolute path is the platform's own job
 * and not what is being tested. A Windows host answers `/Documents/finances.spiccioli` with the current drive in front of it, which
 * is correct: the argument the command line named is still the one that was picked.
 */

const LEDGER = `finances${LEDGER_FILE_CONFIG.extension}`;

describe('LedgerFileArguments', () => {
	test('reads the ledger a packaged launch was started with', () => {
		expect(findLedgerFileArgument({
			argv: [ '/Applications/Spiccioli.app/Contents/MacOS/Spiccioli', `/Documents/${LEDGER}` ],
			isPackaged: true,
			workingDirectory: '/'
		})).toBe(path.resolve('/', `/Documents/${LEDGER}`));
	});

	test('skips the project directory a development run is started on', () => {
		expect(findLedgerFileArgument({
			argv: [ '/node_modules/electron/dist/electron', '/project', `/Documents/${LEDGER}` ],
			isPackaged: false,
			workingDirectory: '/'
		})).toBe(path.resolve('/', `/Documents/${LEDGER}`));
	});

	test('resolves a relative path against the directory the launch came from', () => {
		expect(findLedgerFileArgument({
			argv: [ 'Spiccioli', LEDGER ],
			isPackaged: true,
			workingDirectory: '/home/user/ledgers'
		})).toBe(path.resolve('/home/user/ledgers', LEDGER));
	});

	test('ignores the switches Chromium and Electron leave on the command line', () => {
		expect(findLedgerFileArgument({
			argv: [ 'Spiccioli', '--allow-file-access-from-files', `--trace=${LEDGER}`, `/Documents/${LEDGER}` ],
			isPackaged: true,
			workingDirectory: '/'
		})).toBe(path.resolve('/', `/Documents/${LEDGER}`));
	});

	test('reads the extension whatever case it is written in', () => {
		const shouted = `/Documents/FINANCES${LEDGER_FILE_CONFIG.extension.toUpperCase()}`;

		expect(findLedgerFileArgument({
			argv: [ 'Spiccioli', shouted ],
			isPackaged: true,
			workingDirectory: '/'
		})).toBe(path.resolve('/', shouted));
	});

	test('takes the first ledger where a command line names more than one', () => {
		expect(findLedgerFileArgument({
			argv: [ 'Spiccioli', `/Documents/${LEDGER}`, `/Documents/other${LEDGER_FILE_CONFIG.extension}` ],
			isPackaged: true,
			workingDirectory: '/'
		})).toBe(path.resolve('/', `/Documents/${LEDGER}`));
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
