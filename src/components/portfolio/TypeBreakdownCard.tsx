import type { ReactElement } from 'react';
import { PieChart, pieSliceColour, type PieChartSlice } from 'src/components/common/PieChart';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import type { BreakdownRow, TypeBreakdown } from 'src/logic/portfolio/TypeBreakdown';

/**
 * What shape the portfolio is in: one slice per type present, and the amounts and shares beside it.
 *
 * **The list reads down in the order the slices are drawn clockwise**, both ordered by share and largest first. **A type worth
 * nothing or less keeps its place in the list, shows its amount, reads 0,0% and is given no slice at all** — an overdrawn current
 * account does it, and so does a holding worth less than the fee it would cost to sell.
 *
 * **Shares are computed against the total of the positive types** and not against net worth; the two differ by exactly the
 * negative amounts, which are on screen a line away. **If no type is positive at all the pie is replaced by a line saying so**,
 * and the list still shows every amount.
 */

export interface TypeBreakdownCardProps {
	breakdown: TypeBreakdown;
}

/**
 * The breakdown by type.
 * @param props The card's props.
 * @param props.breakdown The rows, the total the shares are against and the slice count.
 * @returns The card.
 */
export const TypeBreakdownCard = ({ breakdown }: TypeBreakdownCardProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	const labelOf = (row: BreakdownRow): string => {
		return row.side === 'security' ? t(`securityTypes.${row.type}`) : t(`accounts.types.${row.type}`);
	};

	const slices: readonly PieChartSlice[] = breakdown.rows.filter((row) => {
		return row.share !== undefined;
	}).map((row): PieChartSlice => {
		return { key: row.key, label: labelOf(row), value: row.amount };
	});

	return (
		<section className='portfolio-screen-card'>
			<h2 className='portfolio-screen-card-title'>{t('portfolio.types.title')}</h2>
			<div className='portfolio-screen-breakdown'>
				{slices.length === 0 ?
					<p className='portfolio-screen-note'>{t('portfolio.types.nothingPositive')}</p> :
					<PieChart
						slices={slices}
						centreFigure={formatter.integer(breakdown.sliceCount)}
						centreLabel={t('portfolio.types.sliceCount', { count: breakdown.sliceCount })}
						label={t('portfolio.types.chart')}/>}

				<ul className='portfolio-screen-slices' aria-label={t('portfolio.types.title')}>
					{breakdown.rows.map((row, rank) => {
						return (
							<li key={row.key}>
								{/* Only a slice is keyed by a colour, so a row that is given none is given no mark either. Every
									positive row sorts before every other one, so a row's place in the list is its slice's place
									in the ring. */}
								<span
									className='portfolio-screen-slice-mark'
									style={row.share === undefined ? undefined : { backgroundColor: pieSliceColour(rank) }}/>
								<span className='portfolio-screen-slice-label'>{labelOf(row)}</span>
								<span className='portfolio-screen-slice-amount'>
									{formatter.amount(narrowFromWorkingScale(row.amount, MONEY_SCALES.amount))}
								</span>
								<span className='portfolio-screen-slice-share'>
									{row.share === undefined ? t('portfolio.types.noShare') : formatter.percentage(row.share)}
								</span>
							</li>
						);
					})}
				</ul>
			</div>
		</section>
	);
};
