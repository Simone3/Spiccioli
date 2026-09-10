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
 * **What is asserted here is that there is one switch and that both charts follow it**: a window applying to one and not the
 * other would be putting two periods side by side and calling it a comparison ([§8.1]). The charts' own drawing is asserted in
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

const renderCharts = async(): Promise<void> => {
	stubLedgerBridge();
	renderWithProviders(<SalaryChartsHarness/>);
	await screen.findByRole('img', { name: 'Totals per year' });
};

describe('the two salary charts', () => {
	test('share one switch, which is above the pair rather than on either card', async() => {
		await renderCharts();

		const switches = screen.getAllByRole('group', { name: 'Years shown' });

		expect(switches).toHaveLength(1);
		expect(within(switches[0]).getByRole('button', { name: 'Last 5' })).toHaveAttribute('aria-pressed', 'true');
	});

	test('open on the last five years and follow the switch together', async() => {
		await renderCharts();

		expect(drawnYears('Average per month, per year')).toBe(5);
		expect(drawnYears('Totals per year')).toBe(5);

		await userEvent.click(screen.getByRole('button', { name: 'Last 10' }));
		expect(drawnYears('Average per month, per year')).toBe(10);
		expect(drawnYears('Totals per year')).toBe(10);

		// Twelve years, which is more than either window and every row the per-year table holds
		await userEvent.click(screen.getByRole('button', { name: 'All' }));
		expect(drawnYears('Average per month, per year')).toBe(12);
		expect(drawnYears('Totals per year')).toBe(12);
	});
});
