import { compareNames, isSameName } from 'src/logic/accounts/Accounts';
import type { Contract, ContractYear, IsoDate, LedgerDocument, LedgerId, Payslip } from 'src/types/LedgerTypes';

/**
 * Everything pure about a contract: how contracts are ordered, which years one covers, what falls inside its life, and what
 * stands in the way of narrowing its dates or deleting it.
 *
 * **A contract's years come from its own dates and never from its payslips** — from the year it started to the year it ended,
 * or to the current year while it is running. A year in the middle with nothing recorded in it is a row like any other, and
 * that is what makes a gap in the history visible.
 *
 * **The dates and the records that depend on them are enforced from both sides.** A payslip cannot be entered outside the
 * contract's life, and the dates cannot be narrowed past a payslip or a ContractYear that already exists. This file holds the
 * one comparison both of those ask, so the two sides can never disagree about what "inside" means.
 */

/**
 * The two dates that fix a contract's life, and the whole of what "inside the contract" is asked of.
 * The form holds a pair of these before there is a contract to hold them, which is why every comparison here takes the pair
 * rather than the record.
 */
export interface ContractDates {
	startDate: IsoDate;
	endDate: IsoDate | null;
}

/** What one end of the contract's life would leave outside it, which is what the refusal beside that date names. */
export interface ContractDateObstruction {

	// The payslips that would fall outside, by year then month
	payslips: readonly Payslip[];

	// The years whose ContractYear record would fall outside, ascending
	years: readonly number[];
}

/**
 * What both ends would leave outside, kept apart because each is stated beside the date that causes it.
 * Only one of the two can be non-empty for a given record, a record being either before the start or after the end.
 */
export interface ContractDateObstructions {
	beforeStart: ContractDateObstruction;
	afterEnd: ContractDateObstruction;
}

export interface ContractNameQuery {
	contracts: readonly Contract[];
	name: string;

	// The contract being corrected, which is never a duplicate of itself
	exceptId?: LedgerId;
}

export interface ContractDateQuery {

	// The dates as the form now holds them
	dates: ContractDates;

	payslips: readonly Payslip[];
	contractYears: readonly ContractYear[];
}

const yearOf = (date: IsoDate): number => {
	return Number(date.slice(0, 4));
};

const monthOf = (date: IsoDate): number => {
	return Number(date.slice(5, 7));
};

/**
 * Orders contracts the one way they are shown: by the day they started, then by employer to break the tie.
 * @param contracts The contracts.
 * @returns The contracts, ordered.
 */
export const sortContracts = (contracts: readonly Contract[]): Contract[] => {
	return [ ...contracts ].sort((first, second) => {
		if(first.startDate !== second.startDate) {
			return first.startDate < second.startDate ? -1 : 1;
		}

		return compareNames(first.name, second.name);
	});
};

/**
 * Indexes the contracts by their identity, which is how a payslip and a ContractYear reach the one they belong to.
 * @param contracts The contracts.
 * @returns The contracts, by id.
 */
export const indexContracts = (contracts: readonly Contract[]): Map<LedgerId, Contract> => {
	return new Map(contracts.map((contract) => {
		return [ contract.id, contract ];
	}));
};

/**
 * Says whether an employer's name is already taken, which is the uniqueness the validation specification asks of a contract.
 * @param query The name, the contracts it has to be unique among, and the contract that is allowed to hold it.
 * @param query.contracts The contracts.
 * @param query.name The name being checked.
 * @param query.exceptId The contract that is allowed to hold it.
 * @returns Whether another contract already has that name.
 */
export const isContractNameTaken = ({ contracts, name, exceptId }: ContractNameQuery): boolean => {
	return contracts.some((contract) => {
		return contract.id !== exceptId && isSameName(contract.name, name);
	});
};

/**
 * Counts the payslips of each contract, which is what decides whether one can be deleted.
 * @param document The ledger.
 * @returns One entry per contract, including the contracts nothing points at.
 */
export const countPayslipsPerContract = (document: LedgerDocument): Map<LedgerId, number> => {
	const counts = new Map<LedgerId, number>(document.contracts.map((contract) => {
		return [ contract.id, 0 ];
	}));

	for(const payslip of document.payslips) {
		counts.set(payslip.contractId, (counts.get(payslip.contractId) ?? 0) + 1);
	}

	return counts;
};

/**
 * The calendar years a contract covers, which are the rows of the per-year table.
 *
 * They come from the contract's own dates: from the year it started to the year it ended, or to the current year while it is
 * still running. A contract that ended before today keeps exactly the years it ran through, and a contract whose start is in
 * the future is the one year it starts in.
 * @param contract The contract.
 * @param today Today, which is where a running contract's last row is.
 * @returns The years, ascending.
 */
export const contractYearRange = (contract: Contract, today: IsoDate): number[] => {
	const from = yearOf(contract.startDate);
	const to = contract.endDate === null ? Math.max(from, yearOf(today)) : yearOf(contract.endDate);
	const years: number[] = [];

	for(let year = from; year <= to; year++) {
		years.push(year);
	}

	return years;
};

/**
 * Says whether a month falls inside a contract's life, which is what a payslip's `year` and `month` have to satisfy.
 *
 * The comparison is on the month rather than on the day: the month the contract started in is inside it, however late in that
 * month the first day was, and so is the month it ended in. That is what makes a partial first or last year partial rather
 * than absent.
 * @param dates The contract's dates.
 * @param year The payslip's year.
 * @param month The payslip's month.
 * @returns Whether a payslip for that month may point at that contract.
 */
export const isMonthInContract = (dates: ContractDates, year: number, month: number): boolean => {
	const startYear = yearOf(dates.startDate);
	const startMonth = monthOf(dates.startDate);

	if(year < startYear || (year === startYear && month < startMonth)) {
		return false;
	}

	if(dates.endDate === null) {
		return true;
	}

	const endYear = yearOf(dates.endDate);
	const endMonth = monthOf(dates.endDate);

	return year < endYear || (year === endYear && month <= endMonth);
};

/**
 * What a pair of dates would leave outside the contract's life, split by the end that causes it.
 *
 * It is the other side of `isMonthInContract`: widening is always fine, and narrowing is refused while a payslip or a
 * ContractYear would be left outside — which is why this takes the dates the form now holds rather than the contract's stored
 * ones. **A ContractYear is bounded by the contract's dates and not by the rows of the per-year table**: a running contract
 * has no upper bound to be outside of, however far ahead the year is.
 * @param query The dates the form holds, and the records of that contract.
 * @param query.dates The dates as the form now holds them.
 * @param query.payslips The contract's payslips.
 * @param query.contractYears The contract's years.
 * @returns What each end would leave outside, empty throughout when the dates can be taken.
 */
export const contractDateObstructions = ({ dates, payslips, contractYears }: ContractDateQuery): ContractDateObstructions => {
	const startYear = yearOf(dates.startDate);
	const startMonth = monthOf(dates.startDate);
	const endYear = dates.endDate === null ? undefined : yearOf(dates.endDate);

	const byMonth = (first: Payslip, second: Payslip): number => {
		return first.year === second.year ? first.month - second.month : first.year - second.year;
	};

	const isBeforeStart = (year: number, month: number): boolean => {
		return year < startYear || (year === startYear && month < startMonth);
	};

	return {
		beforeStart: {
			payslips: payslips.filter((payslip) => {
				return isBeforeStart(payslip.year, payslip.month);
			}).sort(byMonth),
			years: contractYears.filter((contractYear) => {
				return contractYear.year < startYear;
			}).map((contractYear) => {
				return contractYear.year;
			}).sort((first, second) => {
				return first - second;
			})
		},
		afterEnd: {
			payslips: payslips.filter((payslip) => {
				return !isBeforeStart(payslip.year, payslip.month) && !isMonthInContract(dates, payslip.year, payslip.month);
			}).sort(byMonth),
			years: contractYears.filter((contractYear) => {
				return endYear !== undefined && contractYear.year > endYear;
			}).map((contractYear) => {
				return contractYear.year;
			}).sort((first, second) => {
				return first - second;
			})
		}
	};
};

/**
 * Says whether one end leaves nothing at all outside, which is what the form's save button reads of both.
 * @param obstruction What that end would leave outside.
 * @returns Whether nothing at all would be left outside.
 */
export const isContractDateObstructionEmpty = (obstruction: ContractDateObstruction): boolean => {
	return obstruction.payslips.length === 0 && obstruction.years.length === 0;
};
