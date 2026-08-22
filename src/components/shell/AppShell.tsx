import 'src/components/shell/AppShell.css';
import { useEffect, useRef, type ReactElement } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router';
import { AccountsScreen } from 'src/components/accounts/AccountsScreen';
import { ChecksScreen } from 'src/components/checks/ChecksScreen';
import { CategoriesScreen } from 'src/components/categories/CategoriesScreen';
import { BulkImportScreen } from 'src/components/import/BulkImportScreen';
import { InvestmentsScreen } from 'src/components/investments/InvestmentsScreen';
import { PortfolioScreen } from 'src/components/portfolio/PortfolioScreen';
import { SalariesScreen } from 'src/components/salaries/SalariesScreen';
import { SettingsScreen } from 'src/components/settings/SettingsScreen';
import { APP_ROUTES } from 'src/components/shell/AppRoutes';
import { Sidebar } from 'src/components/shell/Sidebar';
import { StorageNotices } from 'src/components/shell/StorageNotices';
import { TransactionsScreen } from 'src/components/transactions/TransactionsScreen';
import { useChecks } from 'src/contexts/ChecksContext';
import { useLedger } from 'src/contexts/LedgerContext';
import { useScreenMemory } from 'src/contexts/ScreenMemoryContext';

/**
 * What an open file looks like: the sidebar, and one of the screens beside it.
 *
 * **An opened file lands on Portfolio, with no filter set anywhere.** Which screen was last looked at, which filters were on it
 * and which row was selected are not remembered — not between files and not between sessions — so opening one sends the shell
 * back to Portfolio however it was reached and drops what every screen was showing with it.
 *
 * **Within one open file they are remembered**, which is what `ScreenMemoryContext` holds and this is the one place that empties:
 * the memory describes the open file, so it ends where that file does.
 *
 * The routing is "react-router" in declarative mode and nothing more: the router is installed once at the root, over a hash
 * history because a packaged run loads the built page over "file://".
 */

/**
 * The shell.
 * @returns The sidebar and the screen the user is on.
 */
export const AppShell = (): ReactElement => {
	const { filePath } = useLedger();
	const { failingCount } = useChecks();
	const { forgetEverything } = useScreenMemory();
	const navigate = useNavigate();

	// Which file the shell last sent to Portfolio. The router hands back a new "navigate" on every move, so without this the
	// effect would run again after each one and no screen but Portfolio could be reached.
	const landedFilePathRef = useRef<string | undefined>(undefined);

	useEffect(() => {
		if(landedFilePathRef.current === filePath) {
			return;
		}

		landedFilePathRef.current = filePath;
		forgetEverything();
		void navigate(APP_ROUTES.portfolio, { replace: true });
	}, [ filePath, forgetEverything, navigate ]);

	return (
		<div className='app-shell'>
			<Sidebar failingCheckCount={failingCount}/>
			<main className='app-shell-main'>
				<StorageNotices/>
				<Routes>
					<Route path={APP_ROUTES.portfolio} element={<PortfolioScreen/>}/>
					<Route path={APP_ROUTES.accounts} element={<AccountsScreen/>}/>
					<Route path={APP_ROUTES.transactions} element={<TransactionsScreen/>}/>
					<Route path={APP_ROUTES.bulkImport} element={<BulkImportScreen/>}/>
					<Route path={APP_ROUTES.categories} element={<CategoriesScreen/>}/>
					<Route path={APP_ROUTES.investments} element={<InvestmentsScreen/>}/>
					<Route path={APP_ROUTES.salaries} element={<SalariesScreen/>}/>
					<Route path={APP_ROUTES.checks} element={<ChecksScreen/>}/>
					<Route path={APP_ROUTES.settings} element={<SettingsScreen/>}/>
					<Route path='*' element={<Navigate to={APP_ROUTES.portfolio} replace/>}/>
				</Routes>
			</main>
		</div>
	);
};
