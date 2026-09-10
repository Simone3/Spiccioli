import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';
import { beforeAll } from 'vitest';
import { renderWithProviders, stubChartLayout, stubLedgerBridge } from '../testUtils';
import { SalaryCharts } from 'src/components/salaries/SalaryCharts';
import type { SalaryChartWindow, SalaryYearFigures } from 'src/logic/salaries/SalaryFigures';

/**
 * The two charts of the Payslips tab and the one window they share.
 *
 * **What is asserted here is that the two switches are one window**: each chart carries the control, moving either moves both,
 * and there is no moment at which the two charts are showing different years ([§8.1]). The charts' own drawing is asserted in
 * `LineChart.test.tsx`.
 *
 * The container measures the box it is put in, and jsdom lays nothing out, so `stubChartLayout` stands in for the file.
 */

beforeAll(stubChartLayout);

// Twelve years of a contract, every one of them recorded, so that all three windows cut something different
const YEARS: readonly SalaryYearFigures[] = Array.from({ length: 12 }, (unused, index): SalaryYearFigures => {
	return {
		year: 2015 + index,
		payslipCount: 13,
		yearContractGross: 3900000,
		totalGross: 3900000 + index * 100000,
		totalNetSalary: 2600000 + index * 60000,
		workingDays: 250,
		grossPerHour: 1950,
		netPerHour: 1300,
		yearAvgGross: 300000,
		yearAvgNet: 200000
	};
});

const SalaryChartsHarness = (): ReactElement => {
	const [ window, setWindow ] = useState<SalaryChartWindow>('last-5');

	return <SalaryCharts years={YEARS} window={window} onWindowChange={setWindow}/>;
};

// The vertices of the first line of one chart, which is how many years the window kept
const drawnYears = (chart: string): number => {
	const section = screen.getByRole('img', { name: chart }).closest('section') as HTMLElement;
	const path = section.querySelector('path.recharts-curve.recharts-line-curve')?.getAttribute('d') ?? '';

	return (path.match(/L/g) ?? []).length + 1;
};

// The switch drawn on one chart's own card
const switchOf = (chart: string): HTMLElement => {
	const section = screen.getByRole('img', { name: chart }).closest('section') as HTMLElement;

	return within(section).getByRole('group', { name: 'Years shown' });
};

const renderCharts = async(): Promise<void> => {
	stubLedgerBridge();
	renderWithProviders(<SalaryChartsHarness/>);
	await screen.findByRole('img', { name: 'Totals per year' });
};

describe('the two salary charts', () => {
	test('each carry the switch, and both open on the last five years', async() => {
		await renderCharts();

		const switches = screen.getAllByRole('group', { name: 'Years shown' });

		expect(switches).toHaveLength(2);

		for(const control of switches) {
			expect(within(control).getByRole('button', { name: 'Last 5' })).toHaveAttribute('aria-pressed', 'true');
		}

		expect(drawnYears('Average per month, per year')).toBe(5);
		expect(drawnYears('Totals per year')).toBe(5);
	});

	test('move together whichever of the two switches is pressed', async() => {
		await renderCharts();

		// The totals chart's own switch, which moves the averages chart beside it
		await userEvent.click(within(switchOf('Totals per year')).getByRole('button', { name: 'Last 10' }));

		expect(drawnYears('Average per month, per year')).toBe(10);
		expect(drawnYears('Totals per year')).toBe(10);
		expect(within(switchOf('Average per month, per year')).getByRole('button', { name: 'Last 10' }))
			.toHaveAttribute('aria-pressed', 'true');

		// And the averages chart's switch moves the totals chart, twelve years being every row the per-year table holds
		await userEvent.click(within(switchOf('Average per month, per year')).getByRole('button', { name: 'All' }));

		expect(drawnYears('Average per month, per year')).toBe(12);
		expect(drawnYears('Totals per year')).toBe(12);
		expect(within(switchOf('Totals per year')).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
	});
});
