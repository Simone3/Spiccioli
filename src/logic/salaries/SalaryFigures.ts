import { divideAtWorkingScale, MONEY_SCALES, narrowFromWorkingScale, widenToWorkingScale } from 'src/logic/money/Money';
import { contractYearRange } from 'src/logic/salaries/Contracts';
import { groupPayslipsByYear, netSalary, payslipsOfContract, sortPayslipsOfYear } from 'src/logic/salaries/Payslips';
import type { Cents, Contract, ContractYear, IsoDate, Payslip } from 'src/types/LedgerTypes';

/**
 * The salary figures of the calculations specification, one row per year of the contract.
 *
 * **Every figure here is computed within the selected contract only.** Nothing in the application sums across contracts, so the
 * whole of this file takes one contract and its own records.
 *
 * **A year with no payslips reads zero and a year with no ContractYear reads *undefined*, and the two are different facts.**
 * Zero is what was earned in a year nothing was recorded in; *undefined* is a rate that cannot be computed because the divisor
 * was never entered. Neither is a dash and neither is left blank.
 *
 * **Four of these figures come out of a division, which is the only inexact step in the application.** Each one is divided once
 * and rounded once, half away from zero, and lands on the cent it is shown at — nothing downstream combines them further, these
 * being the ends of their own calculations rather than inputs to another.
 */

/** One row of the per-year table, and the two points the charts read off it. */
export interface SalaryYearFigures {
	year: number;

	// What the divisor of the two averages is, which is what the table makes visible
	payslipCount: number;

	// contractGross of the year's last payslip × monthsPerYear, and 0 for a year with no payslips
	yearContractGross: Cents;

	totalGross: Cents;
	totalNetSalary: Cents;

	// The ContractYear's own figure, and undefined where the year has no record at all
	workingDays: number | undefined;

	// Σ gross ÷ (workingDays × hoursPerDay), and the same over netSalary. Undefined exactly where workingDays is.
	grossPerHour: Cents | undefined;
	netPerHour: Cents | undefined;

	// Σ ÷ the payslips there were — not twelve and not monthsPerYear — and 0 for a year with no payslips
	yearAvgGross: Cents;
	yearAvgNet: Cents;
}

export interface SalaryFiguresOptions {
	contract: Contract;

	// Every payslip in the file: this keeps the ones pointing at the contract
	payslips: readonly Payslip[];

	// Every ContractYear in the file, on the same terms
	contractYears: readonly ContractYear[];

	// Today, which is where a running contract's last row is
	today: IsoDate;
}

/**
 * Divides one cent figure by a whole number and lands back on the cent. The one inexact step, rounded half away from zero.
 * @param cents The total, in cents.
 * @param divisor The count divided by, which the caller has already found to be greater than zero.
 * @returns The quotient in cents.
 */
const divideCents = (cents: Cents, divisor: number): Cents => {
	const quotient = divideAtWorkingScale(
		widenToWorkingScale(cents, MONEY_SCALES.amount),
		widenToWorkingScale(divisor, 0)
	);

	return narrowFromWorkingScale(quotient, MONEY_SCALES.amount);
};

/**
 * Divides one cent figure by an amount of hours held in hundredths, which is what the two hourly rates are.
 * @param cents The total, in cents.
 * @param hourHundredths The hours, in hundredths, which the caller has already found to be greater than zero.
 * @returns The rate in cents per hour.
 */
const divideCentsByHours = (cents: Cents, hourHundredths: number): Cents => {
	const quotient = divideAtWorkingScale(
		widenToWorkingScale(cents, MONEY_SCALES.amount),
		widenToWorkingScale(hourHundredths, MONEY_SCALES.hundredths)
	);

	return narrowFromWorkingScale(quotient, MONEY_SCALES.amount);
};

const sumOf = (payslips: readonly Payslip[], figure: (payslip: Payslip) => Cents): Cents => {
	return payslips.reduce((total, payslip) => {
		return total + figure(payslip);
	}, 0);
};

/**
 * The per-year table, one row per calendar year the contract covers.
 *
 * **The rows come from the contract's dates and not from the payslips**, so a year in the middle with nothing recorded in it is
 * a row of zeros rather than a missing row, and a payslip filed under a year the contract never covered has no row to appear in
 * — which the reader's own reference checks are what stop from happening.
 * @param options The contract and the file's records.
 * @param options.contract The contract the screen is scoped to.
 * @param options.payslips Every payslip in the file.
 * @param options.contractYears Every ContractYear in the file.
 * @param options.today Today.
 * @returns One row per year, ascending.
 */
export const deriveSalaryYears = ({ contract, payslips, contractYears, today }: SalaryFiguresOptions): SalaryYearFigures[] => {
	const own = payslipsOfContract(payslips, contract.id);
	const byYear = groupPayslipsByYear(own);
	const workingDaysByYear = new Map(contractYears.filter((contractYear) => {
		return contractYear.contractId === contract.id;
	}).map((contractYear) => {
		return [ contractYear.year, contractYear.workingDays ];
	}));

	return contractYearRange(contract, today).map((year) => {
		const ofYear = sortPayslipsOfYear(byYear.get(year) ?? []);
		const payslipCount = ofYear.length;
		const totalGross = sumOf(ofYear, (payslip) => {
			return payslip.gross;
		});
		const totalNetSalary = sumOf(ofYear, netSalary);

		// The terms as they stood at the end of the year, which is what the contract line on the totals chart is read against
		const last = ofYear[payslipCount - 1];
		const workingDays = workingDaysByYear.get(year);
		const hourHundredths = workingDays === undefined ? undefined : workingDays * contract.hoursPerDay;

		return {
			year,
			payslipCount,
			yearContractGross: last ? last.contractGross * contract.monthsPerYear : 0,
			totalGross,
			totalNetSalary,
			workingDays,
			grossPerHour: hourHundredths === undefined ? undefined : divideCentsByHours(totalGross, hourHundredths),
			netPerHour: hourHundredths === undefined ? undefined : divideCentsByHours(totalNetSalary, hourHundredths),
			yearAvgGross: payslipCount === 0 ? 0 : divideCents(totalGross, payslipCount),
			yearAvgNet: payslipCount === 0 ? 0 : divideCents(totalNetSalary, payslipCount)
		};
	});
};

/**
 * What the payslip table's footer sums. Every one of them is exact: a sum of cents and nothing else.
 * `refunds` and `carPayment` are not among them — `netSalary` is what they are there for, and it is here.
 */
export interface PayslipTotals {
	gross: Cents;
	netPayment: Cents;
	netSalary: Cents;

	// The three credits that reach the pension fund separately, and are therefore totalled separately
	employeeContribution: Cents;
	employerContribution: Cents;
	severanceContribution: Cents;
}

/**
 * Totals the payslips of one year, which is what goes under the rule of the payslip table.
 * @param payslips The payslips of the selected year.
 * @returns The totals, in cents.
 */
export const totalPayslips = (payslips: readonly Payslip[]): PayslipTotals => {
	return {
		gross: sumOf(payslips, (payslip) => {
			return payslip.gross;
		}),
		netPayment: sumOf(payslips, (payslip) => {
			return payslip.netPayment;
		}),
		netSalary: sumOf(payslips, netSalary),
		employeeContribution: sumOf(payslips, (payslip) => {
			return payslip.employeeContribution;
		}),
		employerContribution: sumOf(payslips, (payslip) => {
			return payslip.employerContribution;
		}),
		severanceContribution: sumOf(payslips, (payslip) => {
			return payslip.severanceContribution;
		})
	};
};
