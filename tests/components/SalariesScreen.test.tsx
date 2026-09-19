import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeContract, makeContractYear, makePayslip, makeSeededDocument, renderOpenLedger, stubImportBridge } from '../testUtils';
import type { ImportFileOutcome } from 'src/types/ImportIpcTypes';
import type { LedgerDocument, Payslip } from 'src/types/LedgerTypes';

// An ended contract, so that the rows of the per-year table are the same whatever day the suite is run on
const acme = makeContract({
	id: 'acme',
	name: 'Acme S.p.A.',
	monthsPerYear: 13,
	hoursPerDay: 800,
	startDate: '2025-01-01',
	endDate: '2025-12-31'
});

const payslip = (overrides: Partial<Payslip>): Payslip => {
	return makePayslip({
		contractId: 'acme',
		year: 2025,
		contractGross: 300000,
		gross: 300000,
		netPayment: 200000,
		refunds: 0,
		carPayment: 0,
		employeeContribution: 0,
		employerContribution: 0,
		severanceContribution: 0,
		...overrides
	});
};

const withContract = (overrides: Partial<LedgerDocument> = {}): LedgerDocument => {
	return {
		...makeSeededDocument(),
		contracts: [ acme ],
		contractYears: [],
		payslips: [],
		...overrides
	};
};

const openSalaries = async(document: LedgerDocument): Promise<void> => {
	await renderOpenLedger(document);
	await userEvent.click(screen.getByRole('link', { name: 'Salaries' }));
};

// The heading carries the button whatever the year holds, and an empty year offers it a second time in its empty state
const addPayslip = (): HTMLElement => {
	const heading = document.querySelector('.screen-layout-actions') as HTMLElement;

	return within(heading).getByRole('button', { name: 'Add payslip' });
};

// Month, label, the five entered figures, the derived net salary, and then the one column the three credits are written into
const PENSION_FUND_COLUMN = 8;

/**
 * One printed line, as the pieces along it and the point each of them starts at.
 *
 * **A payslip is a form of boxes**, so a line handed over without its points is a line the template can read nothing out of:
 * the heading naming a figure is on one line and the figure is under it, and which heading it is under is said by where it
 * sits and by nothing else.
 * @param pieces Each piece as the point it starts at and what it says.
 * @returns The line.
 */
const line = (...pieces: readonly (readonly [ number, string ])[]): readonly (readonly [ number, string ])[] => {
	return pieces;
};

// The document the shipped template reads, as the main process hands one over. A March with nothing withheld for a car.
const PAYSLIP_LINES = [
	line([ 27, 'MESE RETRIBUITO' ], [ 113, 'COD.' ]),
	line([ 25, 'MARZO' ], [ 85, '2025' ], [ 121, '000' ]),
	line([ 27, 'RETRIBUZIONE DI FATTO' ], [ 140, 'QUAL.' ], [ 180, 'QUALIFICA' ]),
	line([ 49, '3.300,00 40 IMP. TECNICO' ], [ 289, '50' ]),
	line([ 20, 'CODICE' ], [ 70, 'DESCRIZIONE VOCE' ], [ 344, 'COMPETENZE' ], [ 423, 'TRATTENUTE' ], [ 502, 'DATI STATISTICI' ]),
	line([ 43, '715 NOTA SPESE FEBBRAIO' ], [ 382, '0,00' ]),
	line([ 43, '930 FONDO C/DIPE' ], [ 463, '0,00' ]),
	line([ 43, '931 FONDO C/AZIENDA' ], [ 534, '0,00' ]),
	line([ 43, '935 CONTRIBUZIONE TFR' ], [ 534, '0,00' ]),
	line([ 27, 'TOTALE LORDO' ], [ 120, 'IMPON. CONTR. SOC.' ]),
	line([ 55, '3.300,00' ], [ 133, '3.300,00' ]),
	line([ 27, 'IRPEF ERARIO' ], [ 400, 'ARROTONDAMENTO' ], [ 500, 'NETTO BUSTA' ]),
	line([ 430, '0,00' ], [ 523, '1.990,00' ])
];

// One document as the main process hands it over: the text of each line, and the point each piece of it starts at
const asDocument = (fileName: string, lines: readonly (readonly (readonly [ number, string ])[])[]): ImportFileOutcome => {
	return {
		outcome: 'read',
		fileName,
		rows: lines.map((printed) => {
			return printed.map(([ , text ]) => {
				return text;
			});
		}),
		positions: lines.map((printed) => {
			return printed.map(([ x ]) => {
				return x;
			});
		})
	};
};

// The chooser, whatever it came back with: the template is picked first and the documents second, as it always is
const chooseDocuments = async(files: readonly ImportFileOutcome[]): Promise<void> => {
	stubImportBridge({
		readFiles: () => {
			return Promise.resolve({ outcome: 'read', files });
		}
	});

	await userEvent.click(screen.getByRole('button', { name: 'Import payslip…' }));
	await userEvent.click(screen.getByRole('button', { name: 'Reply Italy PDF' }));
	await userEvent.click(screen.getByRole('button', { name: 'Choose file…' }));
};

// The same document, for another month: the period box is the one line that says which month a payslip is for
const monthOf = (month: string): readonly (readonly (readonly [ number, string ])[])[] => {
	return [ PAYSLIP_LINES[0], line([ 25, month ], [ 85, '2025' ], [ 121, '000' ]), ...PAYSLIP_LINES.slice(2) ];
};

const importPayslip = async(lines: readonly (readonly (readonly [ number, string ])[])[] = PAYSLIP_LINES): Promise<void> => {
	await chooseDocuments([ asDocument('payslip.pdf', lines) ]);
};

const yearRow = (year: string): HTMLElement => {
	return screen.getByRole('button', { name: `Show the payslips of ${year}` }).closest('tr') as HTMLElement;
};

describe('the Salaries screen', () => {
	test('names the action that fills it while there is no contract', async() => {
		await openSalaries(makeSeededDocument());

		expect(screen.getByText(/Add the employer, its months per year/)).toBeInTheDocument();

		await userEvent.click(screen.getByRole('button', { name: 'Add contract' }));

		expect(screen.getByRole('dialog', { name: 'Add contract' })).toBeInTheDocument();
	});

	test('records a contract and opens its years', async() => {
		await openSalaries(makeSeededDocument());
		await userEvent.click(screen.getByRole('button', { name: 'Add contract' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Employer' }), 'Acme S.p.A.');
		await userEvent.type(screen.getByRole('textbox', { name: 'Start date' }), '01/01/2025');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByText('Acme S.p.A. · 12 months per year · 8,00 hours per day')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Show the payslips of 2025' })).toBeInTheDocument();
		expect(screen.getByText('Nothing has been recorded against this contract yet — add the first payslip and its year fills itself in.')).toBeInTheDocument();
	});

	test('records a payslip and derives the year it lands in', async() => {
		await openSalaries(withContract());
		await userEvent.click(addPayslip());
		await userEvent.type(screen.getByRole('textbox', { name: 'Month' }), '1');
		await userEvent.type(screen.getByRole('textbox', { name: 'Contract gross' }), '3300');
		await userEvent.type(screen.getByRole('textbox', { name: 'Gross' }), '3300');
		await userEvent.type(screen.getByRole('textbox', { name: 'Net payment' }), '1990');
		await userEvent.type(screen.getByRole('textbox', { name: 'Refunds' }), '0');
		await userEvent.type(screen.getByRole('textbox', { name: 'Car' }), '180');
		await userEvent.type(screen.getByRole('textbox', { name: 'Employee' }), '0');
		await userEvent.type(screen.getByRole('textbox', { name: 'Employer' }), '0');
		await userEvent.type(screen.getByRole('textbox', { name: 'TFR' }), '0');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

		// Annual contract gross is the month's own gross times the thirteen months the contract carries
		const row = yearRow('2025');

		expect(within(row).getByText('€ 42.900,00')).toBeInTheDocument();
		expect(within(row).getByText('€ 2.170,00')).toBeInTheDocument();
	});

	// The document fills the form in and never the file: the payslip exists once the form the figures landed on is saved
	test('opens the payslip form on what a document was read as, naming the figures it did not carry', async() => {
		await openSalaries(withContract());
		await importPayslip();

		const form = screen.getByRole('dialog', { name: 'Add payslip' });

		expect(within(form).getByText(/Read from payslip\.pdf/)).toBeInTheDocument();
		expect(within(form).getByText(/Not found on it: Car/)).toBeInTheDocument();
		expect(within(form).getByRole('textbox', { name: 'Month' })).toHaveValue('3');
		expect(within(form).getByRole('textbox', { name: 'Gross' })).toHaveValue('3300,00');
		expect(within(form).getByRole('textbox', { name: 'Car' })).toHaveValue('');

		// Nothing has been written: the one row of the year appears once the form is saved, and not before
		expect(within(yearRow('2025')).getByText('0')).toBeInTheDocument();

		await userEvent.type(within(form).getByRole('textbox', { name: 'Car' }), '0');
		await userEvent.click(within(form).getByRole('button', { name: 'Save' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(within(yearRow('2025')).getByText('€ 1.990,00')).toBeInTheDocument();
	});

	// The form's own shorthand for a tredicesima says nothing to anybody reading the table, so the application names it
	test('labels a tredicesima with the application\'s own word and files it into December', async() => {
		await openSalaries(withContract());
		await importPayslip([ line([ 25, '13a MENS.' ], [ 85, '2025' ]), ...PAYSLIP_LINES.slice(2) ]);

		const form = screen.getByRole('dialog', { name: 'Add payslip' });

		expect(within(form).getByRole('textbox', { name: 'Month' })).toHaveValue('12');
		expect(within(form).getByRole('textbox', { name: 'Label' })).toHaveValue('13th');
	});

	// Several documents never reach a form: the recap states what each of them would write, and the ticked rows are written together
	test('opens a recap for a selection of documents and writes the rows that are ticked', async() => {
		await openSalaries(withContract());
		await chooseDocuments([
			asDocument('april.pdf', monthOf('APRILE')),
			asDocument('march.pdf', PAYSLIP_LINES)
		]);

		const recap = screen.getByRole('dialog', { name: 'Import payslips' });

		// The rows are ordered the way the payslip table orders its own, whatever order the chooser handed them over in
		const rows = within(recap).getAllByRole('row').slice(1);

		expect(within(rows[0]).getByText('march.pdf')).toBeInTheDocument();
		expect(within(rows[1]).getByText('april.pdf')).toBeInTheDocument();
		expect(within(rows[0]).getByText('03/2025')).toBeInTheDocument();

		// The one figure the document did not print is written as a zero, and the row says so rather than leaving it to be found
		expect(within(rows[0]).getByText('1 figure was not printed and is written as 0')).toBeInTheDocument();

		// The net payment and the net salary derived from it, which the recap inserts where the payslip table inserts it
		expect(within(rows[0]).getAllByText('€ 1.990,00')).toHaveLength(2);

		// Nothing has been written yet: the year still holds nothing, and it is the save on the recap that fills it
		expect(within(yearRow('2025')).getByText('0')).toBeInTheDocument();

		await userEvent.click(within(recap).getByRole('button', { name: 'Save 2 payslips' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(within(yearRow('2025')).getByText('2')).toBeInTheDocument();
		expect(within(yearRow('2025')).getByText('€ 3.980,00')).toBeInTheDocument();
	});

	// A document that cannot be read is one marked row, and a payslip the file already holds is a flag and not a refusal
	test('marks what it cannot write and unticks what is already there, without touching the rows beside them', async() => {
		await openSalaries(withContract({ payslips: [ payslip({ id: 'march', month: 3 }) ] }));
		await chooseDocuments([
			asDocument('march.pdf', PAYSLIP_LINES),
			asDocument('letter.pdf', [ line([ 27, 'A letter from the bank' ]) ]),
			asDocument('april.pdf', monthOf('APRILE'))
		]);

		const recap = screen.getByRole('dialog', { name: 'Import payslips' });

		expect(within(recap).getByText('Already recorded')).toBeInTheDocument();
		expect(within(recap).getByText('No line naming the month: not a document this template describes')).toBeInTheDocument();
		expect(within(recap).getByRole('checkbox', { name: 'Nothing can be written from letter.pdf' })).toBeDisabled();

		// Only April arrives ticked: the duplicate is unticked and the letter cannot be ticked at all
		expect(within(recap).getByRole('button', { name: 'Save 1 payslip' })).toBeEnabled();

		// A duplicate is untickable by nothing, so somebody who means it can tick it again
		await userEvent.click(within(recap).getByRole('checkbox', { name: 'Write the payslip read from march.pdf' }));
		await userEvent.click(within(recap).getByRole('button', { name: 'Save 2 payslips' }));

		expect(within(yearRow('2025')).getByText('3')).toBeInTheDocument();
	});

	test('refuses a selection of one the same way it always has, on the screen and not in a recap', async() => {
		await openSalaries(withContract());
		await importPayslip([ line([ 27, 'A letter from the bank' ]) ]);

		expect(screen.queryByRole('dialog', { name: 'Import payslips' })).not.toBeInTheDocument();
		expect(screen.getByText(/The line naming the month and the year is not in that document/)).toBeInTheDocument();
	});

	test('refuses a document whose year the contract never covered, and writes nothing', async() => {
		await openSalaries(withContract());
		await importPayslip([ line([ 25, 'MARZO' ], [ 85, '2022' ]), line([ 27, 'TOTALE LORDO' ]), line([ 55, '3.300,00' ]) ]);

		expect(screen.getByText('That payslip is for 2022, which is outside Acme S.p.A.. Nothing has been changed.')).toBeInTheDocument();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	test('refuses a document the template does not describe, and writes nothing', async() => {
		await openSalaries(withContract());
		await importPayslip([ line([ 27, 'A letter from the bank' ]) ]);

		expect(screen.getByText(/The line naming the month and the year is not in that document/)).toBeInTheDocument();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	test('reads the hourly figures as undefined until the working days are entered', async() => {
		await openSalaries(withContract({ payslips: [ payslip({ id: 'january', month: 1, gross: 201600, netPayment: 100800 }) ] }));

		expect(within(yearRow('2025')).getAllByText('undefined')).toHaveLength(2);

		await userEvent.click(within(yearRow('2025')).getByRole('button', { name: 'Edit the working days of 2025' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Working days' }), '252');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		// 252 days of 8 hours is 2 016 hours, so € 2 016,00 of gross is exactly one euro an hour
		expect(within(yearRow('2025')).queryByText('undefined')).not.toBeInTheDocument();
		expect(within(yearRow('2025')).getByText('€ 1,00')).toBeInTheDocument();
	});

	test('puts the year back where it was when the working-days form is saved empty, without confirming', async() => {
		await openSalaries(withContract({
			payslips: [ payslip({ id: 'january', month: 1 }) ],
			contractYears: [ makeContractYear({ contractId: 'acme', year: 2025, workingDays: 252 }) ]
		}));

		await userEvent.click(within(yearRow('2025')).getByRole('button', { name: 'Edit the working days of 2025' }));
		await userEvent.clear(screen.getByRole('textbox', { name: 'Working days' }));
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(within(yearRow('2025')).getAllByText('undefined')).toHaveLength(2);
	});

	test('orders a tredicesima after the December row it shares its month with', async() => {
		await openSalaries(withContract({
			payslips: [
				payslip({ id: 'thirteenth', month: 12, label: '13th' }),
				payslip({ id: 'december', month: 12, label: null }),
				payslip({ id: 'january', month: 1, label: null })
			]
		}));

		const table = screen.getByRole('table', { name: 'Payslips of 2025' });
		const months = within(table).getAllByRole('row').slice(1).map((row) => {
			return within(row).getAllByRole('cell')[0].textContent;
		});

		expect(months).toEqual([ '01/2025', '12/2025', '12/2025' ]);
		expect(within(within(table).getAllByRole('row')[3]).getByText('13th')).toBeInTheDocument();
	});

	// The three credits are one column, because they are three credits into one place
	test('writes the three pension figures into one cell, and one zero where the payslip has nothing under any of them', async() => {
		await openSalaries(withContract({
			payslips: [
				payslip({ id: 'january', month: 1 }),
				payslip({
					id: 'february',
					month: 2,
					employeeContribution: 5000,
					employerContribution: 12000,
					severanceContribution: 0
				})
			]
		}));

		const rows = within(screen.getByRole('table', { name: 'Payslips of 2025' })).getAllByRole('row');
		const pensionFund = (row: HTMLElement): string | null => {
			return within(row).getAllByRole('cell')[PENSION_FUND_COLUMN].textContent;
		};

		expect(pensionFund(rows[1])).toBe('€ 0,00');
		expect(pensionFund(rows[2])).toBe('€ 50,00 + € 120,00 + € 0,00');
	});

	test('refuses to delete a contract a payslip points at, and says what points at it', async() => {
		await openSalaries(withContract({ payslips: [ payslip({ id: 'january', month: 1 }) ] }));
		await userEvent.click(screen.getByRole('tab', { name: /Contracts/ }));
		await userEvent.click(screen.getByRole('button', { name: 'Actions for Acme S.p.A.' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

		expect(screen.getByRole('alert')).toHaveTextContent('Acme S.p.A. cannot be deleted while 1 payslip points at it.');
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	test('refuses a month the contract does not cover, and names it', async() => {
		await openSalaries({
			...withContract(),
			contracts: [ { ...acme, startDate: '2025-06-01' } ]
		});
		await userEvent.click(addPayslip());
		await userEvent.type(screen.getByRole('textbox', { name: 'Month' }), '1');

		expect(screen.getByText('The contract does not cover 01/2025.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

		await userEvent.clear(screen.getByRole('textbox', { name: 'Month' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Month' }), '6');

		expect(screen.queryByText(/does not cover/)).not.toBeInTheDocument();
	});

	test('offers only the contract’s own years on the add form, and follows a payslip into the year it was filed under', async() => {
		await openSalaries({
			...withContract({ payslips: [ payslip({ id: 'january', month: 1, year: 2026 }) ] }),
			contracts: [ { ...acme, endDate: '2026-12-31' } ]
		});
		await userEvent.click(addPayslip());

		const yearPicker = screen.getByRole('combobox', { name: 'Year' });

		expect(within(yearPicker).getAllByRole('option').map((option) => {
			return option.textContent;
		})).toEqual([ '2025', '2026' ]);

		await userEvent.selectOptions(yearPicker, '2025');
		await userEvent.type(screen.getByRole('textbox', { name: 'Month' }), '3');
		await userEvent.type(screen.getByRole('textbox', { name: 'Contract gross' }), '3300');
		await userEvent.type(screen.getByRole('textbox', { name: 'Gross' }), '3300');
		await userEvent.type(screen.getByRole('textbox', { name: 'Net payment' }), '1990');
		await userEvent.type(screen.getByRole('textbox', { name: 'Refunds' }), '0');
		await userEvent.type(screen.getByRole('textbox', { name: 'Car' }), '0');
		await userEvent.type(screen.getByRole('textbox', { name: 'Employee' }), '0');
		await userEvent.type(screen.getByRole('textbox', { name: 'Employer' }), '0');
		await userEvent.type(screen.getByRole('textbox', { name: 'TFR' }), '0');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(screen.getByRole('table', { name: 'Payslips of 2025' })).toBeInTheDocument();
	});
});
