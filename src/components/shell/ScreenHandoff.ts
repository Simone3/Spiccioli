import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { APP_ROUTES } from 'src/components/shell/AppRoutes';
import { useScreenMemory, type RememberedScreen } from 'src/contexts/ScreenMemoryContext';
import type { CheckLink } from 'src/logic/checks/Checks';
import type { IsoDate, LedgerId, TradeKind } from 'src/types/LedgerTypes';

/**
 * How one screen hands its filters to another, and the way back to a record from somewhere that only names it.
 *
 * **However a screen is reached, it is the same screen.** Arriving from a finished import, from a report cell or from a failing
 * check's entry sets the filters where the user would have set them and changes nothing else: the same tables, the same
 * orderings, and every control free to be changed or cleared. **An import leaves no trace on the transactions it created** —
 * the filters are an ordinary set, reachable by hand like any other.
 *
 * **A filter handed over has to select the rows the figure was made of**, which is why a report's period is set rather than
 * cleared: the row total is the sum of the columns on screen, so it hands over the whole of what the table is showing.
 *
 * **A screen reached this way is a fresh arrival** ([§12.2]). What it was showing when it was last left is forgotten before the
 * move, so the handed filters are the whole of what is set on it rather than an addition to filters set an hour ago — a link
 * that meant one thing today and another tomorrow would be worse than no link. **That is what every hand-over is for**, and it
 * is why they are all here rather than on the screens that make them: forgetting and navigating are one action, and one place
 * is where they cannot come apart.
 *
 * A hand-over travels in the router's own location state, which is why this sits beside the routes: the router is the shell's,
 * and every screen that hands over hands over the same way.
 */

export interface TransactionHandoff {
	accountId?: LedgerId;

	// Both ends inclusive, exactly as the period filter is
	fromDate?: IsoDate;
	toDate?: IsoDate;

	// One category, which is what a report cell hands over along with the year it covers
	category?: LedgerId;
}

export interface InvestmentsHandoff {

	// Which of the four tabs to open on
	tab: 'purchases' | 'sales' | 'securities';

	securityId?: LedgerId;

	// Brokerage accounts only, like every account filter on that screen
	accountId?: LedgerId;

	// Both ends inclusive, and a single record is handed over as the one day it is on
	fromDate?: IsoDate;
	toDate?: IsoDate;
}

export interface SalariesHandoff {
	contractId: LedgerId;

	// Which year of that contract's payslips to select, the per-year table always having a row selected
	year: number;
}

/**
 * Reads the filters the Transactions screen was handed.
 * @returns The hand-over, or undefined when the screen was reached from the sidebar.
 */
export const useTransactionHandoff = (): TransactionHandoff | undefined => {
	const location = useLocation();

	// The router types its state as anything at all, so it is read as the one shape this application ever puts there
	return (location.state as TransactionHandoff | null) ?? undefined;
};

/**
 * Reads the tab and filters the Investments screen was handed.
 * @returns The hand-over, or undefined when the screen was reached from the sidebar.
 */
export const useInvestmentsHandoff = (): InvestmentsHandoff | undefined => {
	const location = useLocation();

	return (location.state as InvestmentsHandoff | null) ?? undefined;
};

/**
 * Reads the contract and year the Salaries screen was handed.
 * @returns The hand-over, or undefined when the screen was reached from the sidebar.
 */
export const useSalariesHandoff = (): SalariesHandoff | undefined => {
	const location = useLocation();

	return (location.state as SalariesHandoff | null) ?? undefined;
};

/**
 * The one move every hand-over makes: the screen it lands on is started over, and then it is arrived at.
 * @returns What to call with the screen to start over, the route to it, and what to hand it where anything is handed over.
 */
const useArrival = (): (screen: RememberedScreen | undefined, route: string, handoff?: object) => void => {
	const navigate = useNavigate();
	const { forget } = useScreenMemory();

	return useCallback((screen: RememberedScreen | undefined, route: string, handoff?: object): void => {
		if(screen) {
			forget(screen);
		}

		void navigate(route, handoff === undefined ? undefined : { state: handoff });
	}, [ forget, navigate ]);
};

/**
 * Hands a set of filters to Transactions and goes there.
 * @returns The hand-over.
 */
export const useHandOverToTransactions = (): (handoff: TransactionHandoff) => void => {
	const arriveAt = useArrival();

	return useCallback((handoff: TransactionHandoff): void => {
		arriveAt('transactions', APP_ROUTES.transactions, handoff);
	}, [ arriveAt ]);
};

// Which tab of Investments a trade of each kind lives on
const TRADE_TABS: Record<TradeKind, InvestmentsHandoff['tab']> = {
	purchase: 'purchases',
	sale: 'sales'
};

/**
 * Follows a check entry to the record it names.
 *
 * **Each entry a failing check names links to the record it names**, and the screen it lands on is the ordinary one: the same
 * tables, the same orderings, every control free to be changed or cleared. What the link carries is the tab to open and the
 * filters to open it with, and nothing else — a screen reached this way is not a different screen.
 *
 * **A transaction is handed its account and its own day**, which is the narrowest set of ordinary filters that certainly
 * contains it; a trade is handed its security, its account and its day; a payslip is handed its contract and its year, which is
 * the pair the Payslips tab is always scoped by; a security is handed itself, and an account is handed nothing at all — the
 * Accounts screen has no filter and no paging, so the record is on the table the moment the screen is reached. **It is still an
 * arrival**: the Accounts screen opens on the tab the accounts are on rather than on the one it was left on ([§12.2]).
 *
 * **One link names no record**: a threshold a check's description states is a preference, and following it lands on Settings,
 * which has nothing to be started over.
 * @returns What to call with a link to go there.
 */
export const useFollowCheckLink = (): (link: CheckLink) => void => {
	const arriveAt = useArrival();

	return useCallback((link: CheckLink): void => {
		switch(link.screen) {
			case 'transactions':
				arriveAt('transactions', APP_ROUTES.transactions, {
					accountId: link.accountId,
					fromDate: link.date,
					toDate: link.date
				} satisfies TransactionHandoff);

				return;
			case 'trades':
				arriveAt('investments', APP_ROUTES.investments, {
					tab: TRADE_TABS[link.kind],
					securityId: link.securityId,
					accountId: link.accountId,
					fromDate: link.date,
					toDate: link.date
				} satisfies InvestmentsHandoff);

				return;
			case 'securities':
				arriveAt('investments', APP_ROUTES.investments, {
					tab: 'securities',
					securityId: link.securityId
				} satisfies InvestmentsHandoff);

				return;
			case 'payslips':
				arriveAt('salaries', APP_ROUTES.salaries, { contractId: link.contractId, year: link.year } satisfies SalariesHandoff);

				return;
			case 'settings':
				// Not a record at all: a threshold a check's description states, which leads to the preference that set it
				arriveAt(undefined, APP_ROUTES.settings);

				return;
			case 'accounts':
			default:
				// Accounts has no filter and no paging: every account is on the one table, so arriving there is arriving at the record
				arriveAt('accounts', APP_ROUTES.accounts);
		}
	}, [ arriveAt ]);
};
