import { useState, type CSSProperties, type ReactElement } from 'react';
import { PieChart, pieSliceColour, type PieChartSlice } from 'src/components/common/PieChart';
import { PORTFOLIO_CONFIG } from 'src/config/AppConfig';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { MONEY_SCALES, narrowPartsFromWorkingScale } from 'src/logic/money/Money';
import type { BreakdownRow, TypeBreakdown } from 'src/logic/portfolio/TypeBreakdown';
import type { TenThousandths } from 'src/types/LedgerTypes';

/**
 * What shape the portfolio is in: one slice per type present, and the amounts and shares beside it.
 *
 * **The list reads down in the order the slices are drawn clockwise**, both ordered by share and largest first. It runs in
 * columns and each of them reads downwards, the way the ranking it is in does — which is why the card works out how many
 * columns there are and how many rows fill one, those following from the number of types, and hands the two figures to the
 * stylesheet: CSS can flow rows down a column but it cannot count the rows. **A portfolio of few types keeps the one column it
 * had**, a column of two beside a column of one being no easier to read than three in a row. **A type worth nothing or less
 * keeps its place in the list, shows its amount, reads 0,0% and is given no slice at all** — an overdrawn current account does
 * it, and so does a holding worth less than the fee it would cost to sell.
 *
 * **Shares are computed against the total of the positive types** and not against net worth; the two differ by exactly the
 * negative amounts, which are on screen a line away. **If no type is positive at all the pie is replaced by a line saying so**,
 * and the list still shows every amount.
 *
 * **The amounts add to the headline as printed and not only at the working scale.** A security row is the kind that carries a
 * fraction of a cent, a holding's net proceeds being a product, so the amounts are narrowed against their own total rather than
 * each on its own — which leaves every exact row alone, those having given up nothing in their own rounding.
 *
 * **Pointing at a slice names it, and pointing at a row finds its slice**: the middle of the ring reads that type's share
 * instead of the count, the row it belongs to lights up, and every slice but its own dims behind it. Eleven slices carry eleven
 * colours, and a thin one is quicker to point at than to match by eye — **which is why the dimming matters most from the list
 * end**, a row naming a type the reader then has to find in the ring. **It states what is already on the screen and never hides
 * any of it** — every amount and every share is in the list whether anything is being pointed at or not, so nothing here is
 * behind a pointer.
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

	// Which row the pointer is on, whether it got there over the slice or over the row
	const [ pointedKey, setPointedKey ] = useState<string | undefined>(undefined);

	// The rows are narrowed together, so the list adds up to the headline the same way the breakdown by account does
	const rowAmounts = narrowPartsFromWorkingScale(breakdown.rows.map((row) => {
		return row.amount;
	}), MONEY_SCALES.amount);

	const labelOf = (row: BreakdownRow): string => {
		return row.side === 'security' ? t(`securityTypes.${row.type}`) : t(`accounts.types.${row.type}`);
	};

	const slices: readonly PieChartSlice[] = breakdown.rows.filter((row) => {
		return row.share !== undefined;
	}).map((row): PieChartSlice => {
		return { key: row.key, label: labelOf(row), value: row.amount };
	});

	// A row with no slice is never pointed at: there is nothing in the ring to have found it
	const pointed = breakdown.rows.find((row): row is BreakdownRow & { share: TenThousandths } => {
		return row.key === pointedKey && row.share !== undefined;
	});

	// Where the columns break, which is the one thing about the list's shape the stylesheet cannot work out for itself
	const columns = breakdown.rows.length >= PORTFOLIO_CONFIG.typeListColumns * PORTFOLIO_CONFIG.minimumRowsPerTypeListColumn ?
		PORTFOLIO_CONFIG.typeListColumns :
		1;

	const listLayout = {
		'--portfolio-slice-columns': columns,
		'--portfolio-slice-rows': Math.ceil(breakdown.rows.length / columns)
	} as CSSProperties;

	return (
		<section className='portfolio-screen-card'>
			<h2 className='portfolio-screen-card-title'>{t('portfolio.types.title')}</h2>
			<div className='portfolio-screen-breakdown'>
				{slices.length === 0 ?
					<p className='portfolio-screen-note'>{t('portfolio.types.nothingPositive')}</p> :
					<PieChart
						slices={slices}
						centreFigure={pointed === undefined ?
							formatter.integer(breakdown.sliceCount) :
							formatter.percentage(pointed.share)}
						centreLabel={pointed === undefined ?
							t('portfolio.types.sliceCount', { count: breakdown.sliceCount }) :
							labelOf(pointed)}
						label={t('portfolio.types.chart')}
						onPointAt={setPointedKey}
						pointedKey={pointed?.key}/>}

				<ul className='portfolio-screen-slices' style={listLayout} aria-label={t('portfolio.types.title')}>
					{breakdown.rows.map((row, rank) => {
						return (
							<li
								key={row.key}
								className={row.key === pointed?.key ? 'portfolio-screen-slice-pointed' : undefined}
								onMouseEnter={() => {
									setPointedKey(row.key);
								}}
								onMouseLeave={() => {
									setPointedKey(undefined);
								}}>
								{/* Only a slice is keyed by a colour, so a row that is given none is given no mark either. Every
									positive row sorts before every other one, so a row's place in the list is its slice's place
									in the ring. */}
								<span
									className='portfolio-screen-slice-mark'
									style={row.share === undefined ? undefined : { backgroundColor: pieSliceColour(rank) }}/>
								<span className='portfolio-screen-slice-label'>{labelOf(row)}</span>
								<span className='portfolio-screen-slice-amount'>
									{formatter.amount(rowAmounts[rank])}
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
