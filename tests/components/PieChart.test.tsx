import { screen, within } from '@testing-library/react';
import { beforeAll } from 'vitest';
import { renderWithProviders, stubChartLayout, stubLedgerBridge } from '../testUtils';
import { PieChart, pieSliceColour, type PieChartSlice } from 'src/components/common/PieChart';

/**
 * The one pie, and the one thing worth asserting about it without a browser: that the library draws a sector per slice and
 * takes the colour off the slice rather than off a palette of its own.
 *
 * The container measures the box it is put in, and jsdom lays nothing out, so `stubChartLayout` stands both in for the file.
 */

const SLICES: readonly PieChartSlice[] = [
	{ key: 'stock-etf', label: 'Stock ETF', value: 6595505 },
	{ key: 'term-deposit', label: 'Term deposit', value: 2500000 },
	{ key: 'voucher', label: 'Voucher', value: 26000 }
];

beforeAll(stubChartLayout);

describe('the pie', () => {
	test('draws one sector per slice, each in the colour its rank names, and says what it counts inside the ring', () => {
		stubLedgerBridge();
		renderWithProviders(
			<PieChart slices={SLICES} centreFigure='3' centreLabel='types' label='Portfolio split by type'/>
		);

		const chart = screen.getByRole('img', { name: 'Portfolio split by type' });
		const sectors = chart.querySelectorAll('path.recharts-sector');

		expect(sectors).toHaveLength(SLICES.length);
		expect(sectors[0].getAttribute('fill')).toBe(pieSliceColour(0));
		expect(sectors[2].getAttribute('fill')).toBe(pieSliceColour(2));

		// Every colour is a variable of the one stylesheet, so no slice ever carries a colour written into the markup
		expect(pieSliceColour(0)).toBe('var(--colors-chart-slice-1)');

		expect(within(chart).getByText('3')).toBeInTheDocument();
		expect(within(chart).getByText('types')).toBeInTheDocument();
	});

	test('draws every slice alike until one is marked, and then dims the rest behind it', () => {
		stubLedgerBridge();
		const { rerender } = renderWithProviders(
			<PieChart slices={SLICES} centreFigure='3' centreLabel='types' label='Portfolio split by type'/>
		);

		const opacities = (): (string | null)[] => {
			return Array.from(screen.getByRole('img', { name: 'Portfolio split by type' })
				.querySelectorAll('path.recharts-sector'))
				.map((sector) => {
					return sector.getAttribute('fill-opacity');
				});
		};

		expect(new Set(opacities()).size).toBe(1);

		rerender(
			<PieChart
				slices={SLICES}
				centreFigure='13,7%'
				centreLabel='Term deposit'
				label='Portfolio split by type'
				pointedKey='term-deposit'/>
		);

		// The marked slice is the one left as it was drawn at rest, the rest of the ring having gone back rather than it forward
		const [ first, marked, last ] = opacities();

		expect(marked).toBe('1');
		expect(Number(first)).toBeLessThan(1);
		expect(last).toBe(first);
	});

	test('wraps the palette rather than running out of it', () => {
		expect(pieSliceColour(10)).toBe('var(--colors-chart-slice-11)');
		expect(pieSliceColour(11)).toBe('var(--colors-chart-slice-1)');
	});
});
