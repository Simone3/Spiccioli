import { screen } from '@testing-library/react';
import { beforeAll } from 'vitest';
import { renderWithProviders, stubLedgerBridge } from '../testUtils';
import { LineChart, type LineChartPoint, type LineChartSeries } from 'src/components/common/LineChart';

/**
 * The one chart, and the one thing worth asserting about it without a browser: that the library draws the series it was given,
 * dashes the one that is a term, and skips the point a series does not reach rather than dropping it to zero.
 *
 * The container measures the box it is put in, and jsdom lays nothing out, so the two dimensions are stubbed for the whole file.
 */

const PLOT_WIDTH = 640;

const PLOT_HEIGHT = 200;

const SERIES: readonly LineChartSeries[] = [
	{ key: 'gross', label: 'gross', tone: 1 },
	{ key: 'contract', label: 'contract × months', tone: 3, dashed: true }
];

const POINTS: readonly LineChartPoint[] = [
	{ label: '2024', values: { gross: 100000, contract: 90000 } },
	{ label: '2025', values: { gross: 200000, contract: null } },
	{ label: '2026', values: { gross: 300000, contract: 310000 } }
];

// jsdom lays nothing out and has no ResizeObserver, so the box the container measures is reported by this one instead
class FixedSizeResizeObserver {
	private readonly callback: ResizeObserverCallback;

	public constructor(callback: ResizeObserverCallback) {
		this.callback = callback;
	}

	public observe(target: Element): void {
		const entry = { target, contentRect: { width: PLOT_WIDTH, height: PLOT_HEIGHT } } as ResizeObserverEntry;

		this.callback([ entry ], this as unknown as ResizeObserver);
	}

	public unobserve(): void {
		return undefined;
	}

	public disconnect(): void {
		return undefined;
	}
}

beforeAll(() => {
	Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: FixedSizeResizeObserver });
	Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: PLOT_WIDTH });
	Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: PLOT_HEIGHT });
	Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: PLOT_WIDTH });
	Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: PLOT_HEIGHT });
});

const renderChart = async(): Promise<void> => {
	stubLedgerBridge();
	renderWithProviders(
		<LineChart
			points={POINTS}
			series={SERIES}
			label='Totals per year'
			formatValue={(value) => {
				return `€ ${value / 100}`;
			}}/>
	);
	await screen.findByRole('img', { name: 'Totals per year' });
};

describe('the one chart', () => {
	test('draws one line per series, in the colours the theme fixes', async() => {
		await renderChart();

		const lines = document.querySelectorAll('path.recharts-curve.recharts-line-curve');

		expect(lines).toHaveLength(2);
		expect(lines[0].getAttribute('stroke')).toBe('var(--colors-chart-series-1)');
		expect(lines[1].getAttribute('stroke')).toBe('var(--colors-chart-series-3)');
	});

	test('dashes the series that is a term rather than a measurement', async() => {
		await renderChart();

		const lines = document.querySelectorAll('path.recharts-curve.recharts-line-curve');

		expect(lines[0].getAttribute('stroke-dasharray')).toBeNull();
		expect(lines[1].getAttribute('stroke-dasharray')).not.toBeNull();
	});

	test('skips the point a series does not reach rather than dropping it to zero', async() => {
		await renderChart();

		const lines = document.querySelectorAll('path.recharts-curve.recharts-line-curve');

		// The dashed series holds at the first and the last point only, so its path is two runs rather than one
		expect((lines[1].getAttribute('d') ?? '').match(/M/g)).toHaveLength(2);
		expect((lines[0].getAttribute('d') ?? '').match(/M/g)).toHaveLength(1);
	});

	test('names every series in a key of ours, so a dashed line reads as dashed there too', async() => {
		await renderChart();

		expect(screen.getByText('gross')).toBeInTheDocument();
		expect(screen.getByText('contract × months')).toBeInTheDocument();
	});
});
