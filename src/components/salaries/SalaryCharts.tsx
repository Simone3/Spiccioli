import type { ReactElement } from 'react';
import { useAmountAxisFormatter } from 'src/components/common/ChartAxisFormat';
import { LineChart, type LineChartPoint, type LineChartSeries } from 'src/components/common/LineChart';
import { SegmentedControl, type SegmentedControlOption } from 'src/components/common/SegmentedControl';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import {
	SALARY_CHART_WINDOWS,
	windowSalaryYears,
	type SalaryChartWindow,
	type SalaryYearFigures
} from 'src/logic/salaries/SalaryFigures';

/**
 * The two charts of the Payslips tab, side by side, covering every year of the contract.
 *
 * *Average per month, per year* plots the two averages, whose divisor is the payslips there were rather than twelve — which is
 * what the payslip count in the per-year table makes visible. *Totals per year* plots what was actually earned against the
 * **contract line**, *contract × months*, which is **dashed because it is a term rather than a measurement**.
 *
 * **A year that recorded nothing draws no contract line** rather than dropping it to zero: `yearContractGross` is 0 for such a
 * year and there is no term to state, so the point is left out of that series and the line skips it. Both totals are genuinely
 * zero in that year and are drawn as zero, which is the difference between a figure and an absence.
 *
 * **One window, shown on each of the two cards** ([§8.1]). The two charts are read across — an average against a total, both
 * against the contract line — so the window is the pair's and moving either switch moves both. **The control is drawn on each
 * card rather than once above them** so that it is always beside the chart it governs, including where the window narrows and
 * the two cards stack.
 *
 * **It cuts the view and never the figures**: the per-year table below is never windowed, and every point kept is the figure it
 * always was.
 */

export interface SalaryChartsProps {

	// One row per year the contract covers, ascending
	years: readonly SalaryYearFigures[];

	// How many of those years the pair draws, which the screen holds because it is what it is found showing ([§12.2])
	window: SalaryChartWindow;

	onWindowChange: (window: SalaryChartWindow) => void;
}

/**
 * The two charts.
 * @param props The charts' props.
 * @param props.years The rows the two charts are read off.
 * @param props.window How many of those years the pair draws.
 * @param props.onWindowChange What choosing another window does.
 * @returns The charts.
 */
export const SalaryCharts = ({ years, window, onWindowChange }: SalaryChartsProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const axisValue = useAmountAxisFormatter();

	const shown = windowSalaryYears(years, window);

	const windowOptions: readonly SegmentedControlOption<SalaryChartWindow>[] = SALARY_CHART_WINDOWS.map((option) => {
		return { key: option, label: t(`payslips.charts.window.${option}`) };
	});

	const averageSeries: readonly LineChartSeries[] = [
		{ key: 'gross', label: t('payslips.charts.averageGross'), tone: 1 },
		{ key: 'net', label: t('payslips.charts.averageNet'), tone: 2 }
	];

	const totalSeries: readonly LineChartSeries[] = [
		{ key: 'gross', label: t('payslips.charts.totalGross'), tone: 1 },
		{ key: 'net', label: t('payslips.charts.totalNet'), tone: 2 },
		{ key: 'contract', label: t('payslips.charts.contractLine'), tone: 3, dashed: true }
	];

	const averagePoints: readonly LineChartPoint[] = shown.map((row) => {
		return {
			label: String(row.year),
			values: { gross: row.yearAvgGross, net: row.yearAvgNet }
		};
	});

	const totalPoints: readonly LineChartPoint[] = shown.map((row) => {
		return {
			label: String(row.year),
			values: {
				gross: row.totalGross,
				net: row.totalNetSalary,

				// A year that recorded nothing has no term to state, so the line skips it rather than falling to zero
				contract: row.payslipCount === 0 ? null : row.yearContractGross
			}
		};
	});

	return (
		<div className='salaries-screen-charts'>
			<section className='salaries-screen-card'>
				<div className='salaries-screen-card-heading'>
					<h2 className='salaries-screen-card-title'>{t('payslips.charts.averages')}</h2>
					<SegmentedControl
						options={windowOptions}
						value={window}
						label={t('payslips.charts.window.label')}
						onChange={onWindowChange}/>
				</div>
				<LineChart
					points={averagePoints}
					series={averageSeries}
					label={t('payslips.charts.averages')}
					formatValue={formatter.amount}
					formatAxisValue={axisValue}/>
			</section>

			<section className='salaries-screen-card'>
				<div className='salaries-screen-card-heading'>
					<h2 className='salaries-screen-card-title'>{t('payslips.charts.totals')}</h2>
					<SegmentedControl
						options={windowOptions}
						value={window}
						label={t('payslips.charts.window.label')}
						onChange={onWindowChange}/>
				</div>
				<LineChart
					points={totalPoints}
					series={totalSeries}
					label={t('payslips.charts.totals')}
					formatValue={formatter.amount}
					formatAxisValue={axisValue}/>
			</section>
		</div>
	);
};
