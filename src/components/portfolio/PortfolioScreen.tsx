import 'src/components/portfolio/PortfolioScreen.css';
import { useMemo, type ReactElement } from 'react';
import { Link } from 'react-router';
import { AppLinkButton } from 'src/components/common/AppButton';
import { EmptyState } from 'src/components/common/EmptyState';
import { AccountBalancesTable } from 'src/components/portfolio/AccountBalancesTable';
import { GainsAndCostsCard } from 'src/components/portfolio/GainsAndCostsCard';
import { NetWorthCard } from 'src/components/portfolio/NetWorthCard';
import { NetWorthChart } from 'src/components/portfolio/NetWorthChart';
import { TypeBreakdownCard } from 'src/components/portfolio/TypeBreakdownCard';
import { APP_ROUTES } from 'src/components/shell/AppRoutes';
import { ScreenLayout } from 'src/components/shell/ScreenLayout';
import { useChecks } from 'src/contexts/ChecksContext';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { indexInstitutions, isAccountClosed, sortAccounts } from 'src/logic/accounts/Accounts';
import { deriveHoldings, walkPositions } from 'src/logic/investments/Holdings';
import { deriveGainsAndCosts } from 'src/logic/portfolio/GainsAndCosts';
import { derivePortfolioBalances } from 'src/logic/portfolio/NetWorth';
import { deriveNetWorthSeries } from 'src/logic/portfolio/NetWorthSeries';
import { deriveTypeBreakdown } from 'src/logic/portfolio/TypeBreakdown';

/**
 * The home screen, and the one an opened file always lands on.
 *
 * **Every figure on it is somebody else's output**, which is why it is the last screen built and why it holds no control that
 * changes anything: what it shows is the accounts, the transactions and the trades every other screen records, valued the way
 * the calculations say. It has no filter, no tab and no form.
 *
 * **Everything on it is derived from one walk and one set of balances.** The four lines add to the headline by construction, the
 * breakdown by account totals to the same headline, the breakdown by type divides the same figures, and the last point of the
 * line is the headline to the cent — none of the four is reconciled against the others, they are the same arithmetic read four
 * ways.
 *
 * **The failing-check banner sits above everything else** whenever any check fails, and is absent when they all pass.
 * @returns The screen.
 */
export const PortfolioScreen = (): ReactElement => {
	const translator = useTranslator();
	const { t } = translator;
	const { document } = useLedger();
	const { failingCount } = useChecks();

	const today = DateUtils.toStandardYearMonthDay(DateUtils.startOfToday());

	const portfolio = useMemo(() => {
		if(!document) {
			return undefined;
		}

		const walk = walkPositions(document.trades);
		const holdings = deriveHoldings({ document, walk, translator });
		const balances = derivePortfolioBalances({ document, holdings });

		return {
			balances,
			gains: deriveGainsAndCosts({ document, walk }),
			breakdown: deriveTypeBreakdown({ document, holdings, portfolio: balances }),
			series: deriveNetWorthSeries({ document, walk, today }),
			accounts: sortAccounts(document.accounts, document.institutions),
			institutions: indexInstitutions(document.institutions)
		};
	}, [ document, translator, today ]);

	if(!document || !portfolio || document.accounts.length === 0) {
		return (
			<ScreenLayout title={t('screens.portfolio')}>
				<EmptyState message={t('emptyState.portfolio')}>
					<AppLinkButton to={APP_ROUTES.accounts} variant='primary'>{t('emptyState.goToAccounts')}</AppLinkButton>
				</EmptyState>
			</ScreenLayout>
		);
	}

	const summary = t('portfolio.accounts.footer', {
		accounts: t('accounts.count', { count: portfolio.accounts.length }),
		closed: portfolio.accounts.filter(isAccountClosed).length,
		institutions: t('accounts.institutionCount', { count: document.institutions.length })
	});

	return (
		<ScreenLayout title={t('screens.portfolio')}>
			{failingCount > 0 && (
				<div className='portfolio-screen-banner' role='status'>
					<p>{t('portfolio.failingChecks', { count: failingCount })}</p>
					<Link className='portfolio-screen-link' to={APP_ROUTES.checks}>{t('portfolio.reviewChecks')}</Link>
				</div>
			)}

			<div className='portfolio-screen-columns'>
				<NetWorthCard figures={portfolio.balances.figures}/>
				<GainsAndCostsCard gains={portfolio.gains}/>
			</div>

			<TypeBreakdownCard breakdown={portfolio.breakdown}/>
			<NetWorthChart points={portfolio.series} hasHistory={document.transactions.length > 0 || document.trades.length > 0}/>

			<section className='portfolio-screen-card'>
				<h2 className='portfolio-screen-card-title'>{t('portfolio.accounts.title')}</h2>
				<AccountBalancesTable
					accounts={portfolio.accounts}
					institutions={portfolio.institutions}
					balances={portfolio.balances.balances}
					grossBalances={portfolio.balances.grossBalances}
					summary={summary}
					total={portfolio.balances.figures.netWorth}
					grossTotal={portfolio.balances.grossNetWorth}/>
			</section>
		</ScreenLayout>
	);
};
