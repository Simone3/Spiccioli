import type { Holding } from 'src/logic/investments/Holdings';
import type { WorkingAmount } from 'src/logic/investments/Trades';
import { divideAtWorkingScale, MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import type { PortfolioBalances } from 'src/logic/portfolio/NetWorth';
import {
	ACCOUNT_TYPES,
	SECURITY_TYPES,
	type AccountType,
	type LedgerDocument,
	type LedgerId,
	type Security,
	type SecurityType,
	type TenThousandths
} from 'src/types/LedgerTypes';

/**
 * The breakdown by type: what shape the portfolio is in, over the seven cash types and the four security types.
 *
 * **A brokerage account never appears as a slice of its own** — it is entirely its holdings, and each of those contributes under
 * its *security's* type at the same net value net worth is computed from. Every other account contributes under its own type, a
 * pension fund at its net balance like everywhere else. **Closed accounts and their holdings are in it**, which is what keeps the
 * slices adding to net worth.
 *
 * **Only types actually present get a row**: eleven is the ceiling, and a file with no meal vouchers and no gold draws nine. A
 * type that has been emptied is still present and still a row — it shows `€ 0,00`, reads 0,0% and is given no slice.
 *
 * **Shares are computed against the total of the positive types**, not against net worth: the two differ by exactly the negative
 * amounts, which are on screen a line away. A type totalling nothing or less keeps its place, shows its amount and is given no
 * slice at all — an overdrawn current account does it, and so does a holding worth less than the fee it would cost to sell.
 *
 * **The order is the amounts' own**, largest first, which is the one table in the application ordered that way: the positive
 * types descend by share, and the rest follow by amount descending — zero first, then the negatives from least to most.
 */

export interface BreakdownFigures {
	key: string;
	amount: WorkingAmount;

	// A fraction in ten-thousandths, and undefined on a type totalling nothing or less — which is a row and never a slice
	share: TenThousandths | undefined;
}

// The type itself is what the row is labelled with, and which side it is on is what says how it is written
export type BreakdownRow = BreakdownFigures & ({ side: 'account'; type: AccountType } | { side: 'security'; type: SecurityType });

export interface TypeBreakdown {
	rows: readonly BreakdownRow[];

	// Σ of the types that are worth something, which is what a share is computed against
	positiveTotal: WorkingAmount;

	// How many slices the pie carries, which is the figure at its centre
	sliceCount: number;
}

export interface TypeBreakdownOptions {
	document: LedgerDocument;
	holdings: readonly Holding[];

	// The balances, which is where a cash account's figure and a pension fund's netted one come from
	portfolio: PortfolioBalances;
}

// The eleven, in the order that breaks a tie between two types worth exactly the same: the cash types and then the security ones
const TYPE_ORDER: readonly string[] = [
	...ACCOUNT_TYPES.filter((accountType) => {
		return accountType !== 'brokerage';
	}).map((accountType) => {
		return `account:${accountType}`;
	}),
	...SECURITY_TYPES.map((securityType) => {
		return `security:${securityType}`;
	})
];

/**
 * Sums the portfolio by type and works out what share each one is of the types that are worth something.
 * @param options What the breakdown is summed from.
 * @param options.document The ledger.
 * @param options.holdings The holdings, already valued.
 * @param options.portfolio The balances, which every cash figure comes from.
 * @returns The rows in the order they are read and drawn, the total the shares are against, and the slice count.
 */
export const deriveTypeBreakdown = ({ document, holdings, portfolio }: TypeBreakdownOptions): TypeBreakdown => {
	const securities = new Map<LedgerId, Security>(document.securities.map((security) => {
		return [ security.id, security ];
	}));

	const amounts = new Map<string, WorkingAmount>();

	// A type the portfolio has is a row even when it has been emptied, so presence is recorded before any figure is added to it
	const contribute = (key: string, amount: WorkingAmount): void => {
		amounts.set(key, (amounts.get(key) ?? 0) + amount);
	};

	for(const account of document.accounts) {
		if(account.type === 'brokerage') {
			continue;
		}

		contribute(`account:${account.type}`, portfolio.balances.get(account.id) ?? 0);
	}

	for(const holding of holdings) {
		const security = securities.get(holding.securityId);

		if(security) {
			contribute(`security:${security.type}`, holding.netProceeds);
		}
	}

	const positiveTotal = [ ...amounts.values() ].reduce((running, amount) => {
		return amount > 0 ? running + amount : running;
	}, 0);

	const rows = [ ...amounts.entries() ].map(([ key, amount ]): BreakdownRow => {
		const [ side, type ] = key.split(':');

		const figures: BreakdownFigures = {
			key,
			amount,

			// Nothing is divided by nothing, and a type worth nothing or less has no share of anything either way
			share: amount > 0 && positiveTotal > 0 ?
				narrowFromWorkingScale(divideAtWorkingScale(amount, positiveTotal), MONEY_SCALES.rate) :
				undefined
		};

		return side === 'security' ?
			{ ...figures, side: 'security', type: type as SecurityType } :
			{ ...figures, side: 'account', type: type as AccountType };
	}).sort((first, second) => {
		if(first.amount !== second.amount) {
			return second.amount - first.amount;
		}

		return TYPE_ORDER.indexOf(first.key) - TYPE_ORDER.indexOf(second.key);
	});

	return {
		rows,
		positiveTotal,
		sliceCount: rows.filter((row) => {
			return row.share !== undefined;
		}).length
	};
};
