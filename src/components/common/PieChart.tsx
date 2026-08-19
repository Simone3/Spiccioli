import 'src/components/common/PieChart.css';
import type { ReactElement } from 'react';
import { Pie, PieChart as RechartsPieChart, ResponsiveContainer } from 'recharts';

/**
 * The one pie, and the second of the two files in the application that import the charting library.
 *
 * **Every colour here is a variable of `src/index.css`**, which is what an SVG chart buys: a slice is named by its rank rather
 * than by a colour, the eleven slice variables being fixed in one place. A caller hands over slices already in the order they
 * are drawn in; it never sees the library and never states a colour.
 *
 * **Only slices are passed in.** A row worth nothing or less is not a slice of anything and is the caller's to draw beside the
 * chart, which is where its amount belongs; a caller with no slice at all draws its own line instead of an empty ring.
 *
 * **Pointing at a slice says which one it is, and the chart does not decide what that means.** It reports the slice under the
 * pointer and nothing else: what the middle of the ring then reads, and what the list beside it then does, are the caller's,
 * which is what keeps the ring a picture of the figures rather than a control over them. A caller that wants none of it passes
 * no handler and gets a ring that only ever reads its own count.
 *
 * **Which slice the ring draws full is the caller's too, and is not what the pointer last touched.** The caller hands one back,
 * and every other slice is dimmed rather than the one being brightened: the palette is fixed, so there is no brighter version
 * of a colour to reach for, and dimming the rest is what leaves the marked one reading exactly as it does at rest. That is also
 * what lets a list beside the ring point at a slice the pointer never went near.
 */

// How many colours the palette holds, which is the ceiling the breakdown by type has anyway
export const PIE_SLICE_TONES = 11;

export interface PieChartSlice {
	key: string;
	label: string;

	// The share this slice takes, in whatever units the caller counts in. Always more than zero.
	value: number;
}

// One slice as the library reads it: the colour and the strength are carried on the datum, which is what draws the sector it
// becomes. The stroke is not dimmed with the fill, so the hairline between two dimmed slices stays where it is.
interface PieChartDatum extends PieChartSlice {
	fill: string;
	fillOpacity: number;
}

export interface PieChartProps {

	// The slices, in the order they are drawn clockwise. Never empty.
	slices: readonly PieChartSlice[];

	// What is written in the middle of the ring, which is the slice count and what it counts
	centreFigure: string;
	centreLabel: string;

	// What the chart is called, for whoever is not looking at the heading above it
	label: string;

	// Told the key of the slice under the pointer, and "undefined" when the pointer has left the ring
	onPointAt?: (key: string | undefined) => void;

	// Which slice is drawn full while the rest are dimmed. Undefined draws every slice alike, which is the ring at rest.
	pointedKey?: string;
}

const RING_INNER_RADIUS = '62%';

const RING_OUTER_RADIUS = '100%';

// What a slice is dimmed to while another one is marked: faint enough to recede, strong enough to still read as its own colour
const DIMMED_SLICE_OPACITY = 0.3;

/**
 * The colour a slice of a given rank is drawn in. The palette wraps, which it can only do on a chart of more than eleven
 * slices — one more than the breakdown by type can ever have.
 * @param rank Where the slice falls in the order, from zero.
 * @returns The variable it is drawn with.
 */
export const pieSliceColour = (rank: number): string => {
	return `var(--colors-chart-slice-${rank % PIE_SLICE_TONES + 1})`;
};

/**
 * The one pie.
 * @param props The chart's props.
 * @param props.slices The slices, in the order they are drawn.
 * @param props.centreFigure What is written in the middle.
 * @param props.centreLabel What that figure counts.
 * @param props.label What the chart is called.
 * @param props.onPointAt Told which slice the pointer is over, where the caller keys anything to it.
 * @param props.pointedKey Which slice is drawn full, the rest being dimmed behind it.
 * @returns The ring and what is written inside it.
 */
export const PieChart = ({ slices, centreFigure, centreLabel, label, onPointAt, pointedKey }: PieChartProps): ReactElement => {
	const data: PieChartDatum[] = slices.map((slice, rank) => {
		return {
			...slice,
			fill: pieSliceColour(rank),
			fillOpacity: pointedKey === undefined || pointedKey === slice.key ? 1 : DIMMED_SLICE_OPACITY
		};
	});

	return (
		<div
			className='pie-chart'
			role='img'
			aria-label={label}
			onMouseLeave={() => {
				onPointAt?.(undefined);
			}}>
			<ResponsiveContainer width='100%' height='100%'>
				<RechartsPieChart>
					<Pie
						data={data}
						dataKey='value'
						nameKey='label'
						innerRadius={RING_INNER_RADIUS}
						outerRadius={RING_OUTER_RADIUS}
						stroke='var(--colors-background-secondary)'
						strokeWidth={1}
						startAngle={90}
						endAngle={-270}
						isAnimationActive={false}
						onMouseEnter={(_: unknown, rank: number) => {
							onPointAt?.(data[rank]?.key);
						}}/>
				</RechartsPieChart>
			</ResponsiveContainer>
			<div className='pie-chart-centre' aria-hidden='true'>
				<b>{centreFigure}</b>
				<small>{centreLabel}</small>
			</div>
		</div>
	);
};
