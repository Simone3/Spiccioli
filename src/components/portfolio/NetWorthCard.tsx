import type { ReactElement } from 'react';
import { HintNote } from 'src/components/common/HintNote';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { MONEY_SCALES, narrowFromWorkingScale, narrowPartsFromWorkingScale } from 'src/logic/money/Money';
import type { NetWorthFigures } from 'src/logic/portfolio/NetWorth';

/**
 * The headline and the four lines that add up to it.
 *
 * **Read down, the estimation accumulates.** The first two lines are what the ledger recorded and their notes say that nothing
 * has been applied to them; the last two are the two places the hypothetical liquidation of [§11.3] is applied and their notes
 * say so. **The note that the headline is an estimate is therefore on the four lines rather than on the figure itself**: the
 * headline is their sum and has nothing to say that they do not.
 *
 * **The four are narrowed to the cent against the headline rather than each on its own.** They add to it exactly at the working
 * scale, but two of them carry fractions of a cent — a holding's cost and its net proceeds are both products — so rounding each
 * figure independently can leave the column a cent or two off the total above it. The headline is narrowed on its own and the
 * four are fitted to it, the cent going to whichever line gave up the most in its own rounding.
 *
 * **A pension fund is one line rather than two**, though its contributions and its revaluation are both derived: the exit tax
 * falls on the contributions and not on the revaluation, so there is no honest way to put part of it on a line called *gain*.
 */

export interface NetWorthCardProps {
	figures: NetWorthFigures;
}

// The four, in the order they are read, and whether each one states its direction in its sign and its colour
const LINES = [
	{ key: 'cash', figure: 'cash', signed: false },
	{ key: 'securitiesAtCost', figure: 'securitiesAtCost', signed: false },
	{ key: 'unrealisedNetGain', figure: 'unrealisedNetGain', signed: true },
	{ key: 'pensionNet', figure: 'pensionNet', signed: false }
] as const;

/**
 * The net worth card.
 * @param props The card's props.
 * @param props.figures The headline and its four lines.
 * @returns The card.
 */
export const NetWorthCard = ({ figures }: NetWorthCardProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	// The headline is narrowed on its own and the four are fitted to it, so the column reads as the sum it is
	const netWorth = narrowFromWorkingScale(figures.netWorth, MONEY_SCALES.amount);
	const lineAmounts = narrowPartsFromWorkingScale(LINES.map((line) => {
		return figures[line.figure];
	}), MONEY_SCALES.amount);

	return (
		<section className='portfolio-screen-card'>
			<div className='portfolio-screen-hero'>
				<span className='portfolio-screen-hero-label'>{t('portfolio.netWorth')}</span>
				<span className='portfolio-screen-hero-value'>{formatter.amount(netWorth)}</span>
			</div>
			<hr className='portfolio-screen-rule'/>
			<dl className='portfolio-screen-figures'>
				{LINES.map((line, index) => {
					const amount = lineAmounts[index];
					const tone = amount < 0 ? 'portfolio-screen-negative' : 'portfolio-screen-positive';

					return (
						<div key={line.key} className='portfolio-screen-figure'>
							<dt>
								{t(`portfolio.lines.${line.key}`)}
								<HintNote align='left'>{t(`portfolio.notes.${line.key}`)}</HintNote>
							</dt>
							<dd className={line.signed ? tone : undefined}>{formatter.amount(amount, line.signed)}</dd>
						</div>
					);
				})}
			</dl>
		</section>
	);
};
