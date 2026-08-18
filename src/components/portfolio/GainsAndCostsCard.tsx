import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { APP_ROUTES } from 'src/components/shell/AppRoutes';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import { GAINS_AND_COSTS_ROLES, type GainsAndCosts } from 'src/logic/portfolio/GainsAndCosts';

/**
 * What the portfolio has gained and lost by being kept in banks and funds instead of as cash: five lifetime figures and their
 * total.
 *
 * **It reads in one order: what was taken, then what was added, then the total** — the two negative lines leading because the
 * costs of being banked are the part nobody keeps a running figure for. **Nothing on this card is an estimate**, which is the
 * whole of what it has and the card above it has not, and it is why neither the exit tax nor the unrealised gain is on it.
 *
 * **The total is the figure the card exists to produce**: the net effect of a decade of being banked and invested, against the
 * alternative of having held the money as cash. It is an amount and not a rate, and it reconciles to nothing else on the screen.
 */

export interface GainsAndCostsCardProps {
	gains: GainsAndCosts;
}

/**
 * The gains and costs card.
 * @param props The card's props.
 * @param props.gains The five figures, the omission and the total.
 * @returns The card.
 */
export const GainsAndCostsCard = ({ gains }: GainsAndCostsCardProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	const signedAmount = (cents: number): ReactElement => {
		return (
			<span className={cents < 0 ? 'portfolio-screen-negative' : 'portfolio-screen-positive'}>
				{formatter.amount(cents, true)}
			</span>
		);
	};

	const realisedGain = narrowFromWorkingScale(gains.realisedGain, MONEY_SCALES.amount);
	const total = narrowFromWorkingScale(gains.total, MONEY_SCALES.amount);

	return (
		<section className='portfolio-screen-card'>
			<h2 className='portfolio-screen-card-title'>{t('portfolio.gains.title')}</h2>
			<dl className='portfolio-screen-figures'>
				{GAINS_AND_COSTS_ROLES.map((role) => {
					return (
						<div key={role} className='portfolio-screen-figure'>
							<dt>{t(`portfolio.gains.roles.${role}`)}</dt>
							<dd>{signedAmount(gains.roleTotals[role])}</dd>
						</div>
					);
				})}
				<div className='portfolio-screen-figure'>
					<dt>{t('portfolio.gains.realisedGain')}</dt>
					<dd>{signedAmount(realisedGain)}</dd>
				</div>
			</dl>

			{/* A sale with no average cost behind it is left out of the line and of the total alike, and both say so */}
			{gains.omittedSales > 0 && (
				<p className='portfolio-screen-note'>
					{t('portfolio.gains.omitted', { count: gains.omittedSales })}
					{' '}
					<Link className='portfolio-screen-link' to={APP_ROUTES.checks}>{t('portfolio.gains.omittedLink')}</Link>
				</p>
			)}

			<hr className='portfolio-screen-rule'/>
			<dl className='portfolio-screen-figures'>
				<div className='portfolio-screen-figure portfolio-screen-figure-total'>
					<dt>{t('portfolio.gains.total')}</dt>
					<dd>{signedAmount(total)}</dd>
				</div>
			</dl>
		</section>
	);
};
