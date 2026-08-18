import { makeContract, makeContractYear, makeFullDocument, makePayslip } from '../testUtils';
import {
	contractDateObstructions,
	contractYearRange,
	countPayslipsPerContract,
	isContractDateObstructionEmpty,
	isContractNameTaken,
	isMonthInContract,
	sortContracts
} from 'src/logic/salaries/Contracts';
import type { Contract } from 'src/types/LedgerTypes';

const TODAY = '2026-08-18';

const acme = makeContract({ id: 'acme', name: 'Acme S.p.A.', startDate: '2017-08-01', endDate: null });

describe('contracts', () => {
	test('orders by start date, then by employer', () => {
		const contracts: Contract[] = [
			makeContract({ id: 'c', name: 'Zeta', startDate: '2020-01-01' }),
			makeContract({ id: 'a', name: 'Beta', startDate: '2017-08-01' }),
			makeContract({ id: 'b', name: 'Alpha', startDate: '2020-01-01' })
		];

		expect(sortContracts(contracts).map((contract) => {
			return contract.id;
		})).toEqual([ 'a', 'b', 'c' ]);
	});

	test('is the same name whatever its case and its accents', () => {
		const contracts = [ makeContract({ id: 'acme', name: 'Acme S.p.A.' }) ];

		expect(isContractNameTaken({ contracts, name: 'acme s.p.a.' })).toBe(true);
		expect(isContractNameTaken({ contracts, name: 'acme s.p.a.', exceptId: 'acme' })).toBe(false);
		expect(isContractNameTaken({ contracts, name: 'Other' })).toBe(false);
	});

	test('counts the payslips that block a deletion, including the contracts nothing points at', () => {
		const document = {
			...makeFullDocument(),
			contracts: [ makeContract({ id: 'contract-1' }), makeContract({ id: 'contract-2', name: 'Other' }) ],
			payslips: [ makePayslip({ id: 'p1' }), makePayslip({ id: 'p2', month: 8 }) ]
		};

		expect(countPayslipsPerContract(document).get('contract-1')).toBe(2);
		expect(countPayslipsPerContract(document).get('contract-2')).toBe(0);
	});
});

describe('the years a contract covers', () => {
	test('runs to the current year while the contract is running', () => {
		expect(contractYearRange(acme, TODAY)).toEqual([ 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 ]);
	});

	test('stops at the year it ended in, whatever today is', () => {
		expect(contractYearRange({ ...acme, endDate: '2019-03-31' }, TODAY)).toEqual([ 2017, 2018, 2019 ]);
	});

	test('is the one year it starts in where the start is still ahead', () => {
		expect(contractYearRange({ ...acme, startDate: '2030-01-01' }, TODAY)).toEqual([ 2030 ]);
	});
});

describe('what falls inside a contract', () => {
	test('takes the month the contract started in, however late in it the first day was', () => {
		expect(isMonthInContract(acme, 2017, 8)).toBe(true);
		expect(isMonthInContract(acme, 2017, 7)).toBe(false);
		expect(isMonthInContract(acme, 2016, 12)).toBe(false);
	});

	test('takes the month it ended in and nothing after it', () => {
		const ended = { startDate: '2017-08-01', endDate: '2019-03-15' };

		expect(isMonthInContract(ended, 2019, 3)).toBe(true);
		expect(isMonthInContract(ended, 2019, 4)).toBe(false);
		expect(isMonthInContract(ended, 2020, 1)).toBe(false);
	});

	test('has no upper bound while the contract is running', () => {
		expect(isMonthInContract(acme, 2099, 12)).toBe(true);
	});
});

describe('narrowing a contract past its records', () => {
	const payslips = [
		makePayslip({ id: 'first', contractId: 'acme', year: 2017, month: 9 }),
		makePayslip({ id: 'last', contractId: 'acme', year: 2026, month: 3 })
	];

	const contractYears = [
		makeContractYear({ contractId: 'acme', year: 2017 }),
		makeContractYear({ contractId: 'acme', year: 2026 })
	];

	test('takes a widening without complaint', () => {
		const obstructions = contractDateObstructions({
			dates: { startDate: '2016-01-01', endDate: null },
			payslips,
			contractYears
		});

		expect(isContractDateObstructionEmpty(obstructions.beforeStart)).toBe(true);
		expect(isContractDateObstructionEmpty(obstructions.afterEnd)).toBe(true);
	});

	test('names the payslip a later start would leave behind it, the year of the start still being covered', () => {
		const obstructions = contractDateObstructions({
			dates: { startDate: '2017-10-01', endDate: null },
			payslips,
			contractYears
		});

		expect(obstructions.beforeStart.payslips.map((payslip) => {
			return payslip.id;
		})).toEqual([ 'first' ]);
		expect(obstructions.beforeStart.years).toEqual([]);
		expect(isContractDateObstructionEmpty(obstructions.afterEnd)).toBe(true);
	});

	test('names the year a start moved into a later year would leave behind it', () => {
		const obstructions = contractDateObstructions({
			dates: { startDate: '2018-01-01', endDate: null },
			payslips,
			contractYears
		});

		expect(obstructions.beforeStart.years).toEqual([ 2017 ]);
	});

	test('names the payslip an earlier end would leave after it, and states it on that end alone', () => {
		const obstructions = contractDateObstructions({
			dates: { startDate: '2017-08-01', endDate: '2025-12-31' },
			payslips,
			contractYears
		});

		expect(isContractDateObstructionEmpty(obstructions.beforeStart)).toBe(true);
		expect(obstructions.afterEnd.payslips.map((payslip) => {
			return payslip.id;
		})).toEqual([ 'last' ]);
		expect(obstructions.afterEnd.years).toEqual([ 2026 ]);
	});

	test('leaves a ContractYear ahead of today alone while the contract is running, there being no end to be outside of', () => {
		const obstructions = contractDateObstructions({
			dates: { startDate: '2017-08-01', endDate: null },
			payslips: [],
			contractYears: [ makeContractYear({ contractId: 'acme', year: 2099 }) ]
		});

		expect(isContractDateObstructionEmpty(obstructions.afterEnd)).toBe(true);
	});
});
