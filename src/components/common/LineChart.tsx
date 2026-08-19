import 'src/components/common/LineChart.css';
import type { ReactElement } from 'react';
import { CartesianGrid, Line, LineChart as RechartsLineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * The one chart, and the only file in the application that imports the charting library.
 *
 * **Every colour here is a variable of `src/index.css`**, which is what an SVG chart buys: a series is named by a tone rather
 * than by a colour, and the palette is fixed in one place so two charts never draw the same series two different ways. A caller
 * hands over points, series and the one function that writes a figure; it never sees the library and never states a colour.
 *
 * **A series may be `null` at a point**, which is a stretch the line does not reach rather than a zero — the two are different
 * facts and the chart draws them differently. The key is ours rather than the library's, so a dashed line reads as dashed in
 * the key as well as on the chart.
 *
 * **A chart whose series are one line in two states says so on hover instead of in a key.** The tooltip names every series that
 * reaches the point under the pointer, which is the same words the key would carry and only where they mean something; a key
 * under such a chart names two lines where the reader sees one. A chart whose series are genuinely different measurements keeps
 * its key, and that is the default.
 */

// Which of the five fixed series colours a line is drawn in
export type ChartSeriesTone = 1 | 2 | 3 | 4 | 5;

export interface LineChartSeries {

	// What this series' figure is keyed by on every point
	key: string;

	label: string;
	tone: ChartSeriesTone;

	// Dashed where the line is a term rather than a measurement: the contract line of the salary totals
	dashed?: boolean;
}

export interface LineChartPoint {

	// What the horizontal axis reads at this point: a year, a month
	label: string;

	// One figure per series, in the minor units the caller's own formatter writes. Null is a point the series does not reach.
	values: Readonly<Record<string, number | null>>;
}

export interface LineChartProps {
	points: readonly LineChartPoint[];
	series: readonly LineChartSeries[];

	// What the chart is called, for whoever is not looking at the heading above it
	label: string;

	// How a figure is written, which is the caller's because the chart does not know what its figures are
	formatValue: (value: number) => string;

	// How the value axis writes one, where a shorter form belongs on a tick than in the tooltip. It falls back to the figure
	// written in full, which is right for a chart whose figures are short to begin with.
	formatAxisValue?: (value: number) => string;

	// Whether the series are named under the chart. False where they are one line in two states, which the tooltip says better.
	showSeriesKey?: boolean;
}

// What recharts hands a tooltip of ours. Every field is optional because the library injects them into an element it clones.
interface ChartTooltipEntry {
	dataKey?: string | number;
	value?: number | string | null;
}

interface ChartTooltipProps {
	active?: boolean;
	label?: string | number;
	payload?: readonly ChartTooltipEntry[];
	series: readonly LineChartSeries[];
	formatValue: (value: number) => string;
}

const DASHED_STROKE = '5 4';

// Room for the widest figure an axis holds. A caller that writes its ticks short is what makes this narrow: the axis is given
// a fixed width and a label too wide for it is broken across lines rather than allowed to overflow, which is what pushes the
// topmost tick off the top of the chart and the bottom one down into the labels of the other axis.
const VALUE_AXIS_WIDTH = 68;

// The top leaves the topmost tick the half of itself that sits above the line it names
const CHART_MARGIN = { top: 12, right: 8, bottom: 0, left: 0 };

// How far the labels of the horizontal axis sit below it, which is what keeps the first of them clear of the lowest tick of
// the other axis: the two meet at the corner, one ending where the other begins
const LABEL_AXIS_TICK_MARGIN = 8;

const toneVariable = (tone: ChartSeriesTone): string => {
	return `var(--colors-chart-series-${tone})`;
};

const toneClassName = (tone: ChartSeriesTone): string => {
	return `line-chart-key-mark line-chart-key-mark-${tone}`;
};

/**
 * What one point of the chart reads, which is every series that reaches it.
 * @param props The tooltip's props.
 * @param props.active Whether a point is being pointed at.
 * @param props.label Which point it is.
 * @param props.payload The figures at that point, as the library hands them over.
 * @param props.series The series, which is what names a figure and orders the lines.
 * @param props.formatValue How a figure is written.
 * @returns The tooltip, or nothing while no point is being pointed at.
 */
const ChartTooltip = ({ active, label, payload, series, formatValue }: ChartTooltipProps): ReactElement | null => {
	if(!active || !payload || payload.length === 0) {
		return null;
	}

	// The series a point does not reach is left out rather than written as a dash: it is not a figure at all
	const rows = series.map((line) => {
		const entry = payload.find((candidate) => {
			return candidate.dataKey === line.key;
		});

		return { line, value: typeof entry?.value === 'number' ? entry.value : undefined };
	}).filter((row): row is { line: LineChartSeries; value: number } => {
		return row.value !== undefined;
	});

	return (
		<div className='line-chart-tooltip'>
			<p className='line-chart-tooltip-label'>{label}</p>
			<dl className='line-chart-tooltip-figures'>
				{rows.map((row) => {
					return (
						<div key={row.line.key} className='line-chart-tooltip-figure'>
							<dt>
								<span className={toneClassName(row.line.tone)}/>
								{row.line.label}
							</dt>
							<dd>{formatValue(row.value)}</dd>
						</div>
					);
				})}
			</dl>
		</div>
	);
};

/**
 * The one chart.
 * @param props The chart's props.
 * @param props.points The points, in the order the horizontal axis reads them.
 * @param props.series The lines, in the order they are named.
 * @param props.label What the chart is called.
 * @param props.formatValue How a figure is written.
 * @param props.formatAxisValue How the value axis writes one, the figure in full by default.
 * @param props.showSeriesKey Whether the series are named under the chart.
 * @returns The chart, and the key under it where the series are named there.
 */
export const LineChart = ({
	points,
	series,
	label,
	formatValue,
	formatAxisValue = formatValue,
	showSeriesKey = true
}: LineChartProps): ReactElement => {
	// The library reads a flat row, so the values are spread onto the label the axis reads
	const rows = points.map((point) => {
		return { label: point.label, ...point.values };
	});

	return (
		<div className='line-chart'>
			<div className='line-chart-plot' role='img' aria-label={label}>
				<ResponsiveContainer width='100%' height='100%'>
					<RechartsLineChart data={rows} margin={CHART_MARGIN}>
						<CartesianGrid stroke='var(--colors-chart-grid)' vertical={false}/>
						<XAxis
							dataKey='label'
							stroke='var(--colors-chart-axis)'
							tickLine={false}
							tickMargin={LABEL_AXIS_TICK_MARGIN}
							fontSize={11}/>
						<YAxis
							stroke='var(--colors-chart-axis)'
							tickLine={false}
							width={VALUE_AXIS_WIDTH}
							fontSize={11}
							tickFormatter={(value: number) => {
								return formatAxisValue(value);
							}}/>
						<Tooltip
							cursor={{ stroke: 'var(--colors-border-strong)' }}
							content={<ChartTooltip series={series} formatValue={formatValue}/>}/>
						{series.map((line) => {
							return (
								<Line
									key={line.key}
									type='linear'
									dataKey={line.key}
									stroke={toneVariable(line.tone)}
									strokeWidth={line.dashed ? 1.5 : 2}
									strokeDasharray={line.dashed ? DASHED_STROKE : undefined}
									dot={false}
									activeDot={{ r: 3 }}
									connectNulls={false}
									isAnimationActive={false}/>
							);
						})}
					</RechartsLineChart>
				</ResponsiveContainer>
			</div>
			{showSeriesKey && (
				<ul className='line-chart-key'>
					{series.map((line) => {
						return (
							<li key={line.key}>
								<span className={line.dashed ? `${toneClassName(line.tone)} line-chart-key-mark-dashed` : toneClassName(line.tone)}/>
								{line.label}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
};
