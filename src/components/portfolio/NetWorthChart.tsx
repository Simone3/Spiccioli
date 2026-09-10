import type { ReactElement } from 'react';
import { useAmountAxisFormatter } from 'src/components/common/ChartAxisFormat';
import { LineChart, type LineChartPoint, type LineChartSeries } from 'src/components/common/LineChart';
import { SegmentedControl, type SegmentedControlOption } from 'src/components/common/SegmentedControl';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import {
	NET_WORTH_WINDOWS,
	windowNetWorthPoints,
	type NetWorthPoint,
	type NetWorthWindow
} from 'src/logic/portfolio/NetWorthSeries';

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
 * drawing one solid line.
 *
 * **A security that has no price at all draws its whole life from cost, today's point included**, that fallback never ending
 * where the one before a first price does ([§11.5]). The final point is dashed exactly when the headline above it contains such
 * a holding, and it still equals that headline to the cent — both carry the position at what it cost. A file whose every open
 * holding has a price is the case where the price series runs to the end alone.
 *
 * **The note under the chart states that the rates and the fee taken out at every point are today's**, those being the only
 * ones the file records. The final point needs no note at all: it is the figure printed at the top of the screen.
 *
 * **A file with accounts but nothing recorded on them says it needs history instead of drawing a flat line** ([§14]). The pie
 * beside it is not in that state and never says it: opening balances divide by type perfectly well, and [§3.1] says what a
 * breakdown with nothing positive in it does instead. **That is also the one state with no window switch on it**, there being
 * no line for a window to be a window onto.
 *
 * **The window cuts the points and nothing else** ([§3.1]): the two series, the dash and the note are all computed over the
 * stretch that is showing, so a window every month of which had a price draws one solid line and no second series at all, on a
 * file whose earlier years would have drawn one. What is cut is the view — every point kept is the figure it always was.
 */

export interface NetWorthChartProps {

	// The points, ascending, ending at today
	points: readonly NetWorthPoint[];

	// Whether anything has happened since the accounts were opened, which is what there is a line to draw of
	hasHistory: boolean;

	// Which stretch of the line is showing, which the screen holds because it is what the screen is found showing ([§12.2])
	window: NetWorthWindow;

	onWindowChange: (window: NetWorthWindow) => void;
}

const FROM_PRICES = 'fromPrices';

const FROM_COST = 'fromCost';

/**
 * The net worth chart.
 * @param props The chart's props.
 * @param props.points The points the line is drawn through.
 * @param props.hasHistory Whether anything has been recorded for the line to have a shape.
 * @param props.window Which stretch of the line is showing.
 * @param props.onWindowChange What choosing another stretch does.
 * @returns The chart and its note, or what it is waiting for.
 */
export const NetWorthChart = ({ points, hasHistory, window, onWindowChange }: NetWorthChartProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const axisValue = useAmountAxisFormatter();

	const shown = windowNetWorthPoints(points, window);

	const windowOptions: readonly SegmentedControlOption<NetWorthWindow>[] = NET_WORTH_WINDOWS.map((option) => {
		return { key: option, label: t(`portfolio.chart.window.${option}`) };
	});

	const anyFromCost = shown.some((point) => {
		return point.fromCost;
	});

	const series: readonly LineChartSeries[] = anyFromCost ?
		[
			{ key: FROM_PRICES, label: t('portfolio.chart.fromPrices'), tone: 1 },
			{ key: FROM_COST, label: t('portfolio.chart.fromCost'), tone: 1, dashed: true }
		] :
		[ { key: FROM_PRICES, label: t('portfolio.chart.fromPrices'), tone: 1 } ];

	const chartPoints: readonly LineChartPoint[] = shown.map((point, index): LineChartPoint => {
		const value = narrowFromWorkingScale(point.value, MONEY_SCALES.amount);

		// The cost line runs on to the first point after the stretch it covers, which is where the two meet
		const onCostLine = point.fromCost || shown[index - 1]?.fromCost === true;

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
			<div className='portfolio-screen-chart-heading'>
				<h2 className='portfolio-screen-card-title'>{t('portfolio.chart.title')}</h2>
				{hasHistory &&
					<SegmentedControl
						options={windowOptions}
						value={window}
						label={t('portfolio.chart.window.label')}
						onChange={onWindowChange}/>}
			</div>
			{hasHistory ?
				<>
					<LineChart
						points={chartPoints}
						series={series}
						label={t('portfolio.netWorthChart')}
						formatValue={formatter.amount}
						formatAxisValue={axisValue}/>
					<p className='portfolio-screen-note'>{t('portfolio.chart.rates')}</p>
				</> :
				<p className='portfolio-screen-note'>{t('portfolio.chart.needsHistory')}</p>}
		</section>
	);
};
