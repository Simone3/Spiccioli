import { isCashAccountType } from 'src/logic/accounts/Accounts';
import { categoryIdsWithRole } from 'src/logic/categories/Categories';
import type { Holding } from 'src/logic/investments/Holdings';
import type { WorkingAmount } from 'src/logic/investments/Trades';
import { MONEY_SCALES, multiplyWorkingScaleByRateScale, narrowFromWorkingScale, widenToWorkingScale } from 'src/logic/money/Money';
import type { Account, Cents, LedgerDocument, LedgerId, Transaction } from 'src/types/LedgerTypes';

/**
 * What the portfolio is worth in hand: every account's balance, the four lines net worth divides into, and the pension fund
 * half of the hypothetical liquidation of [§11.3].
 *
 * **The four lines add to the headline by construction and not by reconciliation**, because the three kinds of balance below
 * cover every account exactly once: a pension fund is the fourth line, a brokerage account is split between the second and the
 * third — its cost and its unrealised gain over its own holdings *are* its balance — and every other cash account is the first.
 * Nothing here is stored, and the same pass produces the headline, the four lines and the per-account figures the breakdown
 * reads, so a total and its parts can never be computed two different ways.
 *
 * **Closed accounts are in every figure**, exactly like open ones: a closing date marks an account and sorts it last, it does
 * not take it out of the arithmetic.
 *
 * **Every figure here is at the working scale of eight decimal places** and is narrowed to the cent once, at display — with the
 * one exception the calculations name, the exit tax, which is rounded to the cent before it is subtracted.
 */

// The one account type that is netted for a tax of its own. The other six cash types are money already and carry no haircut.
const PENSION_FUND: Account['type'] = 'pension-fund';

/** A pension fund as [§11.3] values it: what went in, what it made, and what a payout would be taxed. */
export interface PensionFundFigures {

	// The opening balance plus every transaction outside a `value adjustment` category
	contributions: Cents;

	// The sum of the transactions inside one, which is the fund's own revaluation
	revaluation: Cents;

	grossBalance: Cents;

	// The contributions, clamped by the gross balance below and by zero above: nothing is taxed on more than it would pay out
	taxableBase: Cents;

	exitTax: Cents;
	balance: Cents;
}

/** Net worth and the four lines it divides into, which add back to it exactly. */
export interface NetWorthFigures {
	netWorth: WorkingAmount;

	// Σ balances of every cash account that is not a pension fund: money that is already money
	cash: WorkingAmount;

	// Σ holding invested — what was paid for the positions still held, purchase fees included
	securitiesAtCost: WorkingAmount;

	// Σ (holding netProceeds − invested) — what the securities have made or lost, after the tax and the fee of [§11.3]
	unrealisedNetGain: WorkingAmount;

	// Σ balances of every pension fund account, after the exit tax of [§11.3]
	pensionNet: WorkingAmount;
}

export interface PortfolioBalances {
	figures: NetWorthFigures;

	// One entry per account in the file, closed ones included. A brokerage account with no holding reads zero.
	balances: ReadonlyMap<LedgerId, WorkingAmount>;

	// The two halves and the tax of every pension fund account, which is what the account's own note states
	pensionFunds: ReadonlyMap<LedgerId, PensionFundFigures>;
}

export interface PensionFundOptions {

	// The account, which is always a `Pension fund` one
	account: Account;

	// That account's transactions, already narrowed to whatever date the figures are being taken at
	transactions: readonly Transaction[];

	// The identities of the categories carrying the `value adjustment` role, which is what divides the two halves
	valueAdjustmentCategoryIds: ReadonlySet<LedgerId>;
}

export interface PensionFundHalvesOptions {
	account: Account;

	// The opening balance and every transaction outside a `value adjustment` category, already summed
	contributions: Cents;

	// The transactions inside one, already summed
	revaluation: Cents;
}

export interface PortfolioBalancesOptions {
	document: LedgerDocument;

	// The holdings, as the walk of [§11.1] and the valuation of [§11.3] leave them
	holdings: readonly Holding[];
}

/**
 * Says whether an account is the one type that is netted for a tax of its own.
 * @param account The account.
 * @returns Whether it is a pension fund.
 */
export const isPensionFund = (account: Account): boolean => {
	return account.type === PENSION_FUND;
};

/**
 * Takes the exit tax off a pension fund whose two halves are already summed, which is what the net worth line reads at each of
 * its dates.
 *
 * **The base is what was paid in, not what the fund is worth**: a fund's own returns are taxed inside it year by year, so what a
 * payout is taxed on is the money that went in. **The two clamps are what keep the base a real amount** — the gross balance
 * above it is a fund that has lost value, and zero below it is a fund paid out further than it was paid into — and between them
 * they make the balance zero exactly when the gross balance is zero, whichever way the two halves fall.
 *
 * **The rate is the one in the field**, which has no history behind it and is corrected by hand when it moves.
 * @param options The fund and its two halves.
 * @param options.account The pension fund account.
 * @param options.contributions The opening balance plus every transaction outside a `value adjustment` category.
 * @param options.revaluation The transactions inside one.
 * @returns The two halves, the base, the tax and the balance every total in the application uses for the account.
 */
export const netPensionFund = ({ account, contributions, revaluation }: PensionFundHalvesOptions): PensionFundFigures => {
	const grossBalance = contributions + revaluation;
	const taxableBase = Math.max(0, Math.min(contributions, grossBalance));

	// The third of the three places a figure is rounded to the cent mid-calculation, and it is rounded before it is subtracted
	const exitTax = narrowFromWorkingScale(
		multiplyWorkingScaleByRateScale(widenToWorkingScale(taxableBase, MONEY_SCALES.amount), account.exitTaxRate ?? 0),
		MONEY_SCALES.amount
	);

	return {
		contributions,
		revaluation,
		grossBalance,
		taxableBase,
		exitTax,
		balance: grossBalance - exitTax
	};
};

/**
 * Divides a pension fund's transactions into what was paid in and what it made, and takes the exit tax off it.
 * @param options What the fund is divided from.
 * @param options.account The pension fund account.
 * @param options.transactions Its transactions, at whatever date the figures are being taken.
 * @param options.valueAdjustmentCategoryIds The categories carrying the `value adjustment` role.
 * @returns The two halves, the base, the tax and the balance every total in the application uses for the account.
 */
export const derivePensionFund = ({ account, transactions, valueAdjustmentCategoryIds }: PensionFundOptions): PensionFundFigures => {
	let contributions = account.openingBalance;
	let revaluation = 0;

	for(const transaction of transactions) {
		// An uncategorised row is outside a `value adjustment` category and so is money paid in, which is what the split says
		if(transaction.categoryId !== null && valueAdjustmentCategoryIds.has(transaction.categoryId)) {
			revaluation += transaction.amount;
		}
		else {
			contributions += transaction.amount;
		}
	}

	return netPensionFund({ account, contributions, revaluation });
};

/**
 * Derives every account's balance and the four lines net worth divides into, in one pass.
 *
 * A cash account other than a pension fund is its opening balance plus every transaction on it; a pension fund is that, less its
 * exit tax; **a brokerage account holds no money of its own** and is the net value of its holdings after the tax and the sell fee
 * of [§11.3]. **An oversold position contributes nothing to any of them**, no holding being derived for it at all, and no figure
 * here says so — checks 8 and 9 name the trade instead.
 * @param options What the balances are derived from.
 * @param options.document The ledger.
 * @param options.holdings The holdings, already valued.
 * @returns The headline and its four lines, every account's balance, and the pension funds' own figures.
 */
export const derivePortfolioBalances = ({ document, holdings }: PortfolioBalancesOptions): PortfolioBalances => {
	const valueAdjustmentCategoryIds = categoryIdsWithRole(document.categories, 'value-adjustment');
	const transactionsByAccount = new Map<LedgerId, Transaction[]>();

	for(const transaction of document.transactions) {
		const standing = transactionsByAccount.get(transaction.accountId);

		if(standing) {
			standing.push(transaction);
		}
		else {
			transactionsByAccount.set(transaction.accountId, [ transaction ]);
		}
	}

	const balances = new Map<LedgerId, WorkingAmount>();
	const pensionFunds = new Map<LedgerId, PensionFundFigures>();

	let cash = 0;
	let pensionNet = 0;

	for(const account of document.accounts) {
		if(!isCashAccountType(account.type)) {
			// A brokerage account is entirely its holdings, and they are summed below
			balances.set(account.id, 0);

			continue;
		}

		const transactions = transactionsByAccount.get(account.id) ?? [];

		if(isPensionFund(account)) {
			const figures = derivePensionFund({ account, transactions, valueAdjustmentCategoryIds });
			const balance = widenToWorkingScale(figures.balance, MONEY_SCALES.amount);

			pensionFunds.set(account.id, figures);
			balances.set(account.id, balance);
			pensionNet += balance;

			continue;
		}

		const balance = widenToWorkingScale(transactions.reduce((running, transaction) => {
			return running + transaction.amount;
		}, account.openingBalance), MONEY_SCALES.amount);

		balances.set(account.id, balance);
		cash += balance;
	}

	let securitiesAtCost = 0;
	let unrealisedNetGain = 0;

	for(const holding of holdings) {
		const standing = balances.get(holding.accountId);

		if(standing === undefined) {
			continue;
		}

		balances.set(holding.accountId, standing + holding.netProceeds);
		securitiesAtCost += holding.invested;
		unrealisedNetGain += holding.netProceeds - holding.invested;
	}

	return {
		figures: {
			netWorth: cash + securitiesAtCost + unrealisedNetGain + pensionNet,
			cash,
			securitiesAtCost,
			unrealisedNetGain,
			pensionNet
		},
		balances,
		pensionFunds
	};
};
