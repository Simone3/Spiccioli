import { makeContract, makeContractYear, makePayslip } from '../testUtils';
import { netSalary, sortPayslipsOfYear } from 'src/logic/salaries/Payslips';
import { deriveSalaryYears, totalPayslips, type SalaryYearFigures } from 'src/logic/salaries/SalaryFigures';
import type { ContractYear, Payslip } from 'src/types/LedgerTypes';

const TODAY = '2026-08-18';

// Two years of a running contract, so that the last row is the current year and the one before it is whole
const CONTRACT = makeContract({ id: 'acme', monthsPerYear: 13, hoursPerDay: 800, startDate: '2025-01-01', endDate: null });

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

const derive = (payslips: readonly Payslip[], contractYears: readonly ContractYear[] = []): SalaryYearFigures[] => {
	return deriveSalaryYears({ contract: CONTRACT, payslips, contractYears, today: TODAY });
};

const rowOf = (rows: readonly SalaryYearFigures[], year: number): SalaryYearFigures => {
	return rows.find((row) => {
		return row.year === year;
	}) as SalaryYearFigures;
};

describe('net salary', () => {
	test('takes the reimbursements out and puts the car back in', () => {
		expect(netSalary(payslip({ netPayment: 217250, refunds: 18250, carPayment: 18000 }))).toBe(217000);
	});

	test('follows a negative net payment down', () => {
		expect(netSalary(payslip({ netPayment: -50000, refunds: 0, carPayment: 18000 }))).toBe(-32000);
	});
});

describe('the payslips of a year', () => {
	test('orders by month, then by label with the unlabelled row first', () => {
		const ordered = sortPayslipsOfYear([
			payslip({ id: 'thirteenth', month: 12, label: '13th' }),
			payslip({ id: 'january', month: 1, label: null }),
			payslip({ id: 'december', month: 12, label: null })
		]);

		expect(ordered.map((entry) => {
			return entry.id;
		})).toEqual([ 'january', 'december', 'thirteenth' ]);
	});
});

describe('the per-year rows', () => {
	test('come from the contract dates rather than from the payslips', () => {
		expect(derive([]).map((row) => {
			return row.year;
		})).toEqual([ 2025, 2026 ]);
	});

	test('read zero throughout for a year nothing was recorded in', () => {
		const row = rowOf(derive([ payslip({ id: 'a', year: 2026, month: 1 }) ]), 2025);

		expect(row.payslipCount).toBe(0);
		expect(row.yearContractGross).toBe(0);
		expect(row.totalGross).toBe(0);
		expect(row.totalNetSalary).toBe(0);
		expect(row.yearAvgGross).toBe(0);
		expect(row.yearAvgNet).toBe(0);
	});

	test('take the annual contract gross from the year’s last payslip, at the contract’s months per year', () => {
		const row = rowOf(derive([
			payslip({ id: 'january', month: 1, contractGross: 300000 }),
			payslip({ id: 'december', month: 12, contractGross: 330000 })
		]), 2025);

		expect(row.yearContractGross).toBe(330000 * 13);
	});

	test('average over the payslips there were, a tredicesima included', () => {
		const row = rowOf(derive([
			payslip({ id: 'a', month: 11, gross: 300000, netPayment: 200000 }),
			payslip({ id: 'b', month: 12, gross: 300000, netPayment: 200000 }),
			payslip({ id: 'c', month: 12, label: '13th', gross: 300000, netPayment: 239600 })
		]), 2025);

		expect(row.payslipCount).toBe(3);
		expect(row.totalGross).toBe(900000);
		expect(row.yearAvgGross).toBe(300000);
		expect(row.yearAvgNet).toBe(213200);
	});

	test('round an average that does not divide evenly, half away from zero', () => {
		const row = rowOf(derive([
			payslip({ id: 'a', month: 1, gross: 100000 }),
			payslip({ id: 'b', month: 2, gross: 100001 }),
			payslip({ id: 'c', month: 3, gross: 100000 })
		]), 2025);

		expect(row.yearAvgGross).toBe(100000);
	});

	test('read the hourly figures as undefined until the working days are entered', () => {
		const rows = derive([ payslip({ id: 'a', month: 1 }) ]);

		expect(rowOf(rows, 2025).workingDays).toBeUndefined();
		expect(rowOf(rows, 2025).grossPerHour).toBeUndefined();
		expect(rowOf(rows, 2025).netPerHour).toBeUndefined();
	});

	test('divide by the whole calendar year’s hours once the working days are there', () => {
		const rows = derive(
			[ payslip({ id: 'a', month: 1, gross: 201600, netPayment: 100800 }) ],
			[ makeContractYear({ contractId: 'acme', year: 2025, workingDays: 252 }) ]
		);
		const row = rowOf(rows, 2025);

		// 252 days × 8 hours is 2 016 hours, so € 2 016,00 of gross is exactly € 1,00 an hour
		expect(row.workingDays).toBe(252);
		expect(row.grossPerHour).toBe(100);
		expect(row.netPerHour).toBe(50);
	});

	test('keep a year’s ContractYear out of another contract’s rows', () => {
		const rows = derive([], [ makeContractYear({ contractId: 'other', year: 2025, workingDays: 252 }) ]);

		expect(rowOf(rows, 2025).workingDays).toBeUndefined();
	});

	test('count only the payslips of the contract they belong to', () => {
		const rows = derive([
			payslip({ id: 'ours', month: 1 }),
			payslip({ id: 'theirs', month: 2, contractId: 'other' })
		]);

		expect(rowOf(rows, 2025).payslipCount).toBe(1);
	});
});

describe('the payslip totals', () => {
	test('sum every column the footer states, net salary included', () => {
		const totals = totalPayslips([
			payslip({ id: 'a', month: 1, gross: 330000, netPayment: 199000, refunds: 0, carPayment: 18000, employeeContribution: 4100 }),
			payslip({ id: 'b', month: 2, gross: 330000, netPayment: 217250, refunds: 18250, carPayment: 18000, employeeContribution: 4100 })
		]);

		expect(totals.gross).toBe(660000);
		expect(totals.netPayment).toBe(416250);
		expect(totals.netSalary).toBe(434000);
		expect(totals.employeeContribution).toBe(8200);
	});
});
