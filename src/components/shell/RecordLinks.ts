import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { APP_ROUTES } from 'src/components/shell/AppRoutes';
import type { CheckLink } from 'src/logic/checks/Checks';
import type { IsoDate, LedgerId, TradeKind } from 'src/types/LedgerTypes';

/**
 * The way back to a record from somewhere that only names it, which today is the fourteen checks.
 *
 * **Each entry a failing check names links to the record it names**, and the screen it lands on is the ordinary one: the same
 * tables, the same orderings, every control free to be changed or cleared. What the link carries is the tab to open and the
 * filters to open it with, and nothing else — a screen reached this way is not a different screen.
 *
 * Transactions has its own hand-off already, `TransactionHandoff`, because two screens were handing filters to it before this
 * one existed. Investments and Salaries are here, and all three travel the same way: in the router's own location state.
 */

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
 * Reads the tab and filters the Investments screen was handed.
 * @returns The hand-off, or undefined when the screen was reached from the sidebar.
 */
export const useInvestmentsHandoff = (): InvestmentsHandoff | undefined => {
	const location = useLocation();

	return (location.state as InvestmentsHandoff | null) ?? undefined;
};

/**
 * Reads the contract and year the Salaries screen was handed.
 * @returns The hand-off, or undefined when the screen was reached from the sidebar.
 */
export const useSalariesHandoff = (): SalariesHandoff | undefined => {
	const location = useLocation();

	return (location.state as SalariesHandoff | null) ?? undefined;
};

// Which tab of Investments a trade of each kind lives on
const TRADE_TABS: Record<TradeKind, InvestmentsHandoff['tab']> = {
	purchase: 'purchases',
	sale: 'sales'
};

/**
 * Follows a check entry to the record it names.
 *
 * **A transaction is handed its account and its own day**, which is the narrowest set of ordinary filters that certainly
 * contains it; a trade is handed its security, its account and its day; a payslip is handed its contract and its year, which is
 * the pair the Payslips tab is always scoped by; a security is handed itself, and an account is handed nothing at all — the
 * Accounts screen has no filter and no paging, so the record is on the table the moment the screen is reached.
 * @returns What to call with a link to go there.
 */
export const useFollowCheckLink = (): (link: CheckLink) => void => {
	const navigate = useNavigate();

	return useCallback((link: CheckLink): void => {
		switch(link.screen) {
			case 'transactions':
				void navigate(APP_ROUTES.transactions, {
					state: { accountId: link.accountId, fromDate: link.date, toDate: link.date }
				});

				return;
			case 'trades':
				void navigate(APP_ROUTES.investments, {
					state: {
						tab: TRADE_TABS[link.kind],
						securityId: link.securityId,
						accountId: link.accountId,
						fromDate: link.date,
						toDate: link.date
					} satisfies InvestmentsHandoff
				});

				return;
			case 'securities':
				void navigate(APP_ROUTES.investments, {
					state: { tab: 'securities', securityId: link.securityId } satisfies InvestmentsHandoff
				});

				return;
			case 'payslips':
				void navigate(APP_ROUTES.salaries, {
					state: { contractId: link.contractId, year: link.year } satisfies SalariesHandoff
				});

				return;
			case 'accounts':
			default:
				// Accounts has no filter and no paging: every account is on the one table, so arriving there is arriving at the record
				void navigate(APP_ROUTES.accounts);
		}
	}, [ navigate ]);
};
