import { categoryIdsWithRole } from 'src/logic/categories/Categories';
import type { PositionWalk } from 'src/logic/investments/Holdings';
import { sumRealisedGains, tradesOfKind, type WorkingAmount } from 'src/logic/investments/Trades';
import { MONEY_SCALES, widenToWorkingScale } from 'src/logic/money/Money';
import type { Cents, LedgerDocument, LedgerId } from 'src/types/LedgerTypes';

/**
 * What the portfolio has gained and lost by being kept in banks and funds instead of as cash: five lifetime figures and the
 * total they make.
 *
 * **Nothing here is an estimate.** Four of the five are the lifetime sums of the categories carrying a role — `bank fees`,
 * `wealth tax`, `interest and dividends` and `value adjustment` — and the fifth is the realised gain of the sales that have one.
 * Every line is a recorded fact, which is the whole of what this card has and the one above it has not: **the exit tax and the
 * unrealised gain are deliberately absent**, both being [§11.3] estimates.
 *
 * **The four role sums key off roles and never off names**, so a category renamed in the bundle changes nothing about what reads
 * it, and each line sums whatever carries the role without asking which account it was on: a term deposit's accrued interest
 * lands under value adjustments beside a pension fund's own revaluation.
 *
 * **A sale in a position that has ever gone oversold has no realised gain at all**, so the fifth line sums the sales that have
 * one and states how many it left out — and **the total carries the same omission and the same count**, being made of a line
 * that omits them.
 */

// The four roles the card sums, in the order it reads them: what was taken, then what was added
const SUMMED_ROLES = [ 'bank-fees', 'wealth-tax', 'interest-and-dividends', 'value-adjustment' ] as const;

export type GainsAndCostsRole = typeof SUMMED_ROLES[number];

export interface GainsAndCosts {

	// One per role, at the sign the transactions carry: the two costs come out negative because the rows do
	roleTotals: Readonly<Record<GainsAndCostsRole, Cents>>;

	realisedGain: WorkingAmount;

	// How many sales the realised gain left out, which the card states and the total carries
	omittedSales: number;

	total: WorkingAmount;
}

export interface GainsAndCostsOptions {
	document: LedgerDocument;

	// The positions as the walk of [§11.1] left them, which is where a sale's realised gain comes from
	walk: PositionWalk;
}

// The four roles, in the order the card reads them, so a caller draws the lines without knowing which roles they are
export const GAINS_AND_COSTS_ROLES: readonly GainsAndCostsRole[] = SUMMED_ROLES;

/**
 * Sums the five lifetime figures and the total they make.
 * @param options What the figures are summed from.
 * @param options.document The ledger.
 * @param options.walk The positions as the walk left them.
 * @returns The five figures, the count of the sales left out, and the total.
 */
export const deriveGainsAndCosts = ({ document, walk }: GainsAndCostsOptions): GainsAndCosts => {
	const idsPerRole = new Map<GainsAndCostsRole, ReadonlySet<LedgerId>>(SUMMED_ROLES.map((role) => {
		return [ role, categoryIdsWithRole(document.categories, role) ];
	}));

	const roleTotals: Record<GainsAndCostsRole, Cents> = {
		'bank-fees': 0,
		'wealth-tax': 0,
		'interest-and-dividends': 0,
		'value-adjustment': 0
	};

	for(const transaction of document.transactions) {
		if(transaction.categoryId === null) {
			continue;
		}

		for(const role of SUMMED_ROLES) {
			if(idsPerRole.get(role)?.has(transaction.categoryId)) {
				roleTotals[role] += transaction.amount;

				break;
			}
		}
	}

	const realised = sumRealisedGains(tradesOfKind(document.trades, 'sale'), walk.realisedGains);
	const recorded = SUMMED_ROLES.reduce((running, role) => {
		return running + roleTotals[role];
	}, 0);

	return {
		roleTotals,
		realisedGain: realised.total,
		omittedSales: realised.omitted,
		total: widenToWorkingScale(recorded, MONEY_SCALES.amount) + realised.total
	};
};
