import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { APP_ROUTES } from 'src/components/shell/AppRoutes';
import type { IsoDate, LedgerId } from 'src/types/LedgerTypes';

/**
 * How one screen hands its filters to Transactions.
 *
 * **However the screen is reached, it is the same screen.** Arriving from a finished import sets the filters where the user
 * would have set them and changes nothing else: the same ordering, the last page of what they now match, and every control free
 * to be changed or cleared. **An import leaves no trace on the transactions it created** — the filters are an ordinary
 * account-and-period pair, reachable by hand like any other.
 *
 * The handoff travels in the router's own location state, which is why it lives beside the routes rather than on either screen:
 * the router is the shell's, and the report of a later phase hands over the same way.
 */

export interface TransactionHandoff {
	accountId?: LedgerId;

	// Both ends inclusive, exactly as the period filter is
	fromDate?: IsoDate;
	toDate?: IsoDate;
}

/**
 * Reads the filters the screen was handed, where it was handed any.
 * @returns The handoff, or undefined when the screen was reached from the sidebar with no filter set anywhere.
 */
export const useTransactionHandoff = (): TransactionHandoff | undefined => {
	const location = useLocation();

	// The router types its state as anything at all, so it is read as the one shape this application ever puts there
	return (location.state as TransactionHandoff | null) ?? undefined;
};

/**
 * Hands a set of filters to Transactions and goes there.
 * @returns The hand-over.
 */
export const useHandOverToTransactions = (): (handoff: TransactionHandoff) => void => {
	const navigate = useNavigate();

	return useCallback((handoff: TransactionHandoff): void => {
		void navigate(APP_ROUTES.transactions, { state: handoff });
	}, [ navigate ]);
};
