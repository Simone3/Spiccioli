import type { ReactElement } from 'react';
import { useAmountAxisFormatter } from 'src/components/common/ChartAxisFormat';
import { LineChart, type LineChartPoint, type LineChartSeries } from 'src/components/common/LineChart';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { SalaryYearFigures } from 'src/logic/salaries/SalaryFigures';

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
 */

export interface SalaryChartsProps {

	// One row per year the contract covers, ascending
	years: readonly SalaryYearFigures[];
}

/**
 * The two charts.
 * @param props The charts' props.
 * @param props.years The rows the two charts are read off.
 * @returns The charts.
 */
export const SalaryCharts = ({ years }: SalaryChartsProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const axisValue = useAmountAxisFormatter();

	const averageSeries: readonly LineChartSeries[] = [
		{ key: 'gross', label: t('payslips.charts.averageGross'), tone: 1 },
		{ key: 'net', label: t('payslips.charts.averageNet'), tone: 2 }
	];

	const totalSeries: readonly LineChartSeries[] = [
		{ key: 'gross', label: t('payslips.charts.totalGross'), tone: 1 },
		{ key: 'net', label: t('payslips.charts.totalNet'), tone: 2 },
		{ key: 'contract', label: t('payslips.charts.contractLine'), tone: 3, dashed: true }
	];

	const averagePoints: readonly LineChartPoint[] = years.map((row) => {
		return {
			label: String(row.year),
			values: { gross: row.yearAvgGross, net: row.yearAvgNet }
		};
	});

	const totalPoints: readonly LineChartPoint[] = years.map((row) => {
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
				<h2 className='salaries-screen-card-title'>{t('payslips.charts.averages')}</h2>
				<LineChart
					points={averagePoints}
					series={averageSeries}
					label={t('payslips.charts.averages')}
					formatValue={formatter.amount}
					formatAxisValue={axisValue}/>
			</section>

			<section className='salaries-screen-card'>
				<h2 className='salaries-screen-card-title'>{t('payslips.charts.totals')}</h2>
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
