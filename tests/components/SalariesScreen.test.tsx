import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeContract, makeContractYear, makePayslip, makeSeededDocument, renderOpenLedger } from '../testUtils';
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
		expect(screen.getByText('Acme S.p.A. · 13 months per year · 8,00 hours per day')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Show the payslips of 2025' })).toBeInTheDocument();
		expect(screen.getByText('Nothing has been recorded against this contract yet — add the first payslip and its year fills itself in.')).toBeInTheDocument();
	});

	test('records a payslip and derives the year it lands in', async() => {
		await openSalaries(withContract());
		await userEvent.click(screen.getByRole('button', { name: 'Add payslip' }));
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
		const months = within(table).getAllByRole('row').slice(1, -1).map((row) => {
			return within(row).getAllByRole('cell')[0].textContent;
		});

		expect(months).toEqual([ '01/2025', '12/2025', '12/2025' ]);
		expect(within(within(table).getAllByRole('row')[3]).getByText('13th')).toBeInTheDocument();
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
		await userEvent.click(screen.getByRole('button', { name: 'Add payslip' }));
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
		await userEvent.click(screen.getByRole('button', { name: 'Add payslip' }));

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
