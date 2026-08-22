import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { makeSeededDocument, renderWithProviders, stubLedgerBridge, TEST_LEDGER_PATH } from '../testUtils';
import { SpiccioliApp } from 'src/components/SpiccioliApp';
import { useLedger } from 'src/contexts/LedgerContext';
import { createLedgerId } from 'src/logic/ledger/LedgerDocument';
import { writeLedgerDocument } from 'src/logic/ledger/LedgerWriter';
import type { LedgerCloseDoor, SpiccioliLedgerApi } from 'src/types/LedgerIpcTypes';

/**
 * What a close does when the file never took the changes the session is ending with.
 *
 * The write-failure panel is the ordinary way a failed write ends, and the session carries on in memory behind it. **But the
 * ways out of the application do not go through that panel**: the File menu and the window's own close button are the
 * platform's and reach the session whatever is on screen. A close that went ahead there would take the model with it, and
 * nothing else has a copy of it.
 */

const SAVED_AT = new Date(2026, 7, 8, 14, 32).toISOString();

// A change to the open file, made the way every screen makes one
const Changer = (): ReactElement => {
	const { updateDocument } = useLedger();

	return (
		<button
			type='button'
			onClick={() => {
				updateDocument((current) => {
					return {
						...current,
						institutions: [ ...current.institutions, { id: createLedgerId(), name: 'A bank', defaultSellFee: 0, notes: '' } ]
					};
				});
			}}>
			change something
		</button>
	);
};

interface CloseHarness {
	closedDoors: LedgerCloseDoor[];
	cancelledCloses: { value: number };
	pausedCloses: { value: number };
	prepareForClose: (door: LedgerCloseDoor) => void;
}

/**
 * Opens a ledger whose every write fails, with a hold of the close the main process asks for.
 * @returns What the bridge was asked for while the test ran.
 */
const openLedgerThatCannotBeWritten = async(): Promise<CloseHarness> => {
	const closedDoors: LedgerCloseDoor[] = [];
	const cancelledCloses = { value: 0 };
	const pausedCloses = { value: 0 };
	let listener: ((door: LedgerCloseDoor) => void) | undefined;

	const overrides: Partial<SpiccioliLedgerApi> = {
		getRecentFiles: () => {
			return Promise.resolve([ { filePath: TEST_LEDGER_PATH, lastOpenedAt: SAVED_AT, missing: false } ]);
		},
		readFile: () => {
			return Promise.resolve({
				outcome: 'read',
				filePath: TEST_LEDGER_PATH,
				contents: writeLedgerDocument(makeSeededDocument()),
				sizeBytes: 100
			});
		},
		save: () => {
			return Promise.resolve({ ok: false, filePath: TEST_LEDGER_PATH, message: 'No space left on device.' });
		},
		closeSession: (request) => {
			closedDoors.push(request.door);

			return Promise.resolve({ written: false });
		},
		cancelClose: () => {
			cancelledCloses.value += 1;

			return Promise.resolve();
		},
		pauseClose: () => {
			pausedCloses.value += 1;

			return Promise.resolve();
		},
		onPrepareForClose: (given) => {
			listener = given;

			return () => {
				listener = undefined;
			};
		}
	};

	stubLedgerBridge(overrides);
	renderWithProviders(<><SpiccioliApp/><Changer/></>);

	await userEvent.click(await screen.findByRole('button', { name: /finances\.spiccioli/ }));
	await screen.findByRole('heading', { name: 'Portfolio', level: 1 });
	await userEvent.click(screen.getByRole('button', { name: 'change something' }));

	return {
		closedDoors,
		cancelledCloses,
		pausedCloses,
		prepareForClose: (door) => {
			listener?.(door);
		}
	};
};

describe('a close that found changes the file never took', () => {
	test('asks instead of closing, and says what stopped the write', async() => {
		const harness = await openLedgerThatCannotBeWritten();

		harness.prepareForClose('quit');

		expect(await screen.findByText('Your last changes have not been saved')).toBeInTheDocument();

		// The blocking panel behind it is saying the same thing, so the reason is looked for in the dialog that is asking
		expect(within(screen.getByRole('dialog')).getByText('No space left on device.')).toBeInTheDocument();
		expect(harness.closedDoors).toEqual([]);
	});

	// The main process is counting, and a person reading a dialog is slower than anything it counts for
	test('holds the shutdown wait off while the question is up', async() => {
		const harness = await openLedgerThatCannotBeWritten();

		harness.prepareForClose('quit');
		await screen.findByText('Your last changes have not been saved');

		expect(harness.pausedCloses.value).toBe(1);
		expect(harness.cancelledCloses.value).toBe(0);
	});

	test('staying keeps the file open and calls the quit off', async() => {
		const harness = await openLedgerThatCannotBeWritten();

		harness.prepareForClose('quit');
		await userEvent.click(await screen.findByRole('button', { name: 'Stay' }));

		expect(harness.closedDoors).toEqual([]);
		expect(harness.cancelledCloses.value).toBe(1);
		expect(screen.getByRole('heading', { name: 'Portfolio', level: 1 })).toBeInTheDocument();
	});

	test('giving the changes up is what closes the session', async() => {
		const harness = await openLedgerThatCannotBeWritten();

		harness.prepareForClose('quit');
		await userEvent.click(await screen.findByRole('button', { name: 'Discard changes and close' }));

		await waitFor(() => {
			expect(harness.closedDoors).toEqual([ 'quit' ]);
		});

		expect(harness.cancelledCloses.value).toBe(0);
	});

	// Leaving this file for another one is a close like any other, and the same question stands in front of it
	test('stands in front of leaving one file for another', async() => {
		const harness = await openLedgerThatCannotBeWritten();

		harness.prepareForClose('open-file');

		expect(await screen.findByText('Your last changes have not been saved')).toBeInTheDocument();
		expect(harness.closedDoors).toEqual([]);

		// Nothing was holding a wait, so nothing has to be told the wait can stop
		expect(harness.pausedCloses.value).toBe(0);
	});
});
