import type { ReactElement } from 'react';
import { useAmountAxisFormatter } from 'src/components/common/ChartAxisFormat';
import { LineChart, type LineChartPoint, type LineChartSeries } from 'src/components/common/LineChart';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import type { NetWorthPoint } from 'src/logic/portfolio/NetWorthSeries';

/**
 * Net worth over time, and the one note that carries what the line does not say for itself.
 *
 * **It is two series over one array rather than a per-point dash**: *from prices* and *from cost*, each `null` where the other
 * holds. That is what makes a cost-based stretch nameable — the tooltip names whichever series reaches the point under the
 * pointer — and the cost series carries the first point after the stretch it ends, so the two lines meet rather than leaving a
 * gap.
 *
 * **The series are not named in a key under the chart**, because they are one line in two states rather than two measurements:
 * a key would name two lines where the reader sees one, and it would name them everywhere rather than over the months they
 * apply to. **The cost series still exists only when there is one**, a file every month of which had a price for every holding
 * drawing one solid line. **Today's point is never drawn from cost**, a price never being dated ahead, so the price series is
 * never the missing one.
 *
 * **The note under the chart states that the rates and the fee taken out at every point are today's**, those being the only
 * ones the file records. The final point needs no note at all: it is the figure printed at the top of the screen.
 *
 * **A file with accounts but nothing recorded on them says it needs history instead of drawing a flat line** ([§14]). The pie
 * beside it is not in that state and never says it: opening balances divide by type perfectly well, and [§3.1] says what a
 * breakdown with nothing positive in it does instead.
 */

export interface NetWorthChartProps {

	// The points, ascending, ending at today
	points: readonly NetWorthPoint[];

	// Whether anything has happened since the accounts were opened, which is what there is a line to draw of
	hasHistory: boolean;
}

const FROM_PRICES = 'fromPrices';

const FROM_COST = 'fromCost';

/**
 * The net worth chart.
 * @param props The chart's props.
 * @param props.points The points the line is drawn through.
 * @param props.hasHistory Whether anything has been recorded for the line to have a shape.
 * @returns The chart and its note, or what it is waiting for.
 */
export const NetWorthChart = ({ points, hasHistory }: NetWorthChartProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const axisValue = useAmountAxisFormatter();

	const anyFromCost = points.some((point) => {
		return point.fromCost;
	});

	const series: readonly LineChartSeries[] = anyFromCost ?
		[
			{ key: FROM_PRICES, label: t('portfolio.chart.fromPrices'), tone: 1 },
			{ key: FROM_COST, label: t('portfolio.chart.fromCost'), tone: 1, dashed: true }
		] :
		[ { key: FROM_PRICES, label: t('portfolio.chart.fromPrices'), tone: 1 } ];

	const chartPoints: readonly LineChartPoint[] = points.map((point, index): LineChartPoint => {
		const value = narrowFromWorkingScale(point.value, MONEY_SCALES.amount);

		// The cost line runs on to the first point after the stretch it covers, which is where the two meet
		const onCostLine = point.fromCost || points[index - 1]?.fromCost === true;

		return {
			label: t('portfolio.chart.monthOfYear', { month: point.date.slice(5, 7), year: point.date.slice(0, 4) }),
			values: {
				[FROM_PRICES]: point.fromCost ? null : value,
				[FROM_COST]: onCostLine ? value : null
			}
		};
	});

	return (
		<section className='portfolio-screen-card'>
			<h2 className='portfolio-screen-card-title'>{t('portfolio.chart.title')}</h2>
			{hasHistory ?
				<>
					<LineChart
						points={chartPoints}
						series={series}
						label={t('portfolio.netWorthChart')}
						formatValue={formatter.amount}
						formatAxisValue={axisValue}
						showSeriesKey={false}/>
					<p className='portfolio-screen-note'>{t('portfolio.chart.rates')}</p>
				</> :
				<p className='portfolio-screen-note'>{t('portfolio.chart.needsHistory')}</p>}
		</section>
	);
};
