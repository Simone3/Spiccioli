import { Fragment, type ReactElement } from 'react';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { partialYearMonths, type CategoryReport, type CategoryReportGroupKey, type CategoryReportRow, type CategoryReportTotals } from 'src/logic/categories/CategoryReport';
import type { SpiccioliTranslationKey } from 'src/i18n/Translations';
import type { Category, Cents, IsoDate } from 'src/types/LedgerTypes';

/**
 * The categories × years matrix.
 *
 * **It is not the one table of the kit and could not be**: its columns are the years the file happens to hold, it carries a
 * group heading between blocks of rows, three subtotals and the emphasised Net line the whole thing exists to produce. It wears
 * the same classes so it reads as the same table, and the shape is its own.
 *
 * **The whole table is shown; there is no paging.** **Every figure in a category row is a link** and every subtotal, Net
 * included, is not: a subtotal is a sum of rows rather than a set of transactions. **A cell with nothing recorded is an em dash
 * rather than € 0,00**, so a real zero stays distinguishable from nothing at all, and an em dash is not a link.
 */

export interface CategoryReportTableProps {
	report: CategoryReport;

	// Today, which is what makes the last column a partial year
	today: IsoDate;

	// Called with the year a cell belongs to, or with undefined for the row total, which carries the whole of what is on screen
	onOpen: (category: Category, year: number | undefined) => void;
}

// What each group's closing line is called. The Investments group ends in nothing, so it has none.
const SUBTOTAL_LABEL_KEYS: Record<CategoryReportGroupKey, SpiccioliTranslationKey | undefined> = {
	income: 'report.subtotals.income',
	expense: 'report.subtotals.expense',
	internal: 'report.subtotals.internal',
	investments: undefined
};

const amountClassName = (amount: Cents): string => {
	if(amount > 0) {
		return 'categories-screen-positive';
	}

	return amount < 0 ? 'categories-screen-negative' : 'categories-screen-nothing';
};

/**
 * The report.
 * @param props The table's props.
 * @param props.report The matrix.
 * @param props.today Today.
 * @param props.onOpen What clicking a figure does.
 * @returns The table.
 */
export const CategoryReportTable = ({ report, today, onOpen }: CategoryReportTableProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	const columnCount = report.years.length + 2;

	const renderFigure = (row: CategoryReportRow, amount: Cents | undefined, year: number | undefined): ReactElement | string => {
		if(amount === undefined) {
			return t('table.notApplicable');
		}

		const label = year === undefined ?
			t('report.openTotal', { category: row.category.name }) :
			t('report.openCell', { category: row.category.name, year: String(year) });

		return (
			<button
				type='button'
				className={`categories-screen-link ${amountClassName(amount)}`}
				aria-label={label}
				onClick={() => {
					onOpen(row.category, year);
				}}>
				{formatter.amount(amount, true)}
			</button>
		);
	};

	const renderTotalsRow = (key: string, className: string, label: string, totals: CategoryReportTotals): ReactElement => {
		return (
			<tr key={key} className={className}>
				<th scope='row'>{label}</th>
				{totals.cells.map((cell, column) => {
					return (
						<td key={report.years[column]} className={`data-table-numeric ${amountClassName(cell)}`}>
							{formatter.amount(cell, true)}
						</td>
					);
				})}
				<td className={`data-table-numeric ${amountClassName(totals.total)}`}>
					{formatter.amount(totals.total, true)}
				</td>
			</tr>
		);
	};

	return (
		<div className='data-table-scroll'>
			<table className='data-table categories-screen-report' aria-label={t('report.table')}>
				<thead>
					<tr>
						<th scope='col'>{t('report.columns.category')}</th>
						{report.years.map((year) => {
							const months = partialYearMonths(year, today);

							return (
								<th key={year} scope='col' className='data-table-numeric'>
									{String(year)}
									{months !== undefined && <span className='categories-screen-partial'>{t('report.partialYear', { count: months })}</span>}
								</th>
							);
						})}
						<th scope='col' className='data-table-numeric'>{t('report.columns.total')}</th>
					</tr>
				</thead>
				<tbody>
					{report.groups.map((group) => {
						const subtotal = group.subtotal;
						const subtotalLabelKey = SUBTOTAL_LABEL_KEYS[group.key];

						return (
							<Fragment key={group.key}>
								<tr className='categories-screen-report-group'>
									<th scope='colgroup' colSpan={columnCount}>{t(`report.groups.${group.key}`)}</th>
								</tr>
								{group.rows.map((row) => {
									return (
										<tr key={row.category.id}>
											<th scope='row'>{row.category.name}</th>
											{row.cells.map((cell, column) => {
												return (
													<td key={report.years[column]} className='data-table-numeric'>
														{renderFigure(row, cell, report.years[column])}
													</td>
												);
											})}
											<td className='data-table-numeric'>{renderFigure(row, row.total, undefined)}</td>
										</tr>
									);
								})}
								{subtotal && subtotalLabelKey && renderTotalsRow(
									`${group.key}-subtotal`,
									'categories-screen-report-subtotal',
									t(subtotalLabelKey),
									subtotal
								)}
								{group.key === 'internal' && renderTotalsRow('net', 'categories-screen-report-net', t('report.net'), report.net)}
							</Fragment>
						);
					})}
				</tbody>
			</table>
		</div>
	);
};
