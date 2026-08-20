import 'src/components/common/DataTable.css';
import type { ReactElement, ReactNode } from 'react';

/**
 * The one table, the totals row a table that sums its columns ends on, and the footer under the rule.
 *
 * A column says how it is read rather than how it is drawn: a numeric column is set in the mono in tabular figures, so a column
 * of amounts is a column of one digit width. **Every column starts at the same edge**, a figure included. **A zero is not an
 * empty state** and renders like any other figure; a screen with nothing to put in the table shows the empty state instead of
 * the table's own headers.
 *
 * **A total belongs in the column it totals**, so a column that has one states it in `total` and the table ends on a row of
 * them, under the figures they are the sum of. The row is drawn as soon as any column carries one, and the columns that carry
 * none — a name, a type, the place a thing is held — are spanned by the label the table is given. **The footer is what is left
 * over**: prose about how the table is built, which is a sentence and not a figure.
 */

export interface DataTableColumn<TRow> {
	key: string;

	// What the column is called. A control rather than a word where the column holds one, which today is the selection checkbox.
	header: ReactNode;

	// Set in the mono in tabular figures: every amount, quantity, price and count
	numeric?: boolean;

	render: (row: TRow) => ReactNode;

	// What the last row of the table reads in this column. A column with nothing to total leaves it out.
	total?: ReactNode;
}

export interface DataTableProps<TRow> {
	columns: readonly DataTableColumn<TRow>[];
	rows: readonly TRow[];
	getRowKey: (row: TRow) => string;

	// What the table is called, for whoever is not looking at the heading above it
	label: string;

	// What a row that is stated more quietly than the others is called: a closed account, dimmed and last
	getRowClassName?: (row: TRow) => string | undefined;

	// What the leading columns of the totals row read, spanning every column up to the first that carries a total
	totalLabel?: ReactNode;

	// The line under the rule: what the screen's own specification says goes there
	footer?: ReactNode;
}

const cellClassName = (column: DataTableColumn<unknown>): string | undefined => {
	return column.numeric ? 'data-table-numeric' : undefined;
};

/**
 * The one table.
 * @param props The table's props.
 * @param props.columns The columns, in the order they are shown.
 * @param props.rows The rows, already in the order the screen's specification fixes.
 * @param props.getRowKey What tells two rows apart.
 * @param props.label What the table is called.
 * @param props.getRowClassName What a row is called, where the screen states one more quietly than the others.
 * @param props.totalLabel What the columns before the first total read, where the table has any.
 * @param props.footer What goes under the rule, where there is anything.
 * @returns The table.
 */
export const DataTable = <TRow, >({
	columns,
	rows,
	getRowKey,
	label,
	getRowClassName,
	totalLabel,
	footer
}: DataTableProps<TRow>): ReactElement => {
	const firstTotal = columns.findIndex((column) => {
		return column.total !== undefined;
	});

	return (
		<div className='data-table-scroll'>
			<table className='data-table' aria-label={label}>
				<thead>
					<tr>
						{columns.map((column) => {
							return (
								<th key={column.key} scope='col' className={cellClassName(column as DataTableColumn<unknown>)}>
									{column.header}
								</th>
							);
						})}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => {
						return (
							<tr key={getRowKey(row)} className={getRowClassName?.(row)}>
								{columns.map((column) => {
									return (
										<td key={column.key} className={cellClassName(column as DataTableColumn<unknown>)}>
											{column.render(row)}
										</td>
									);
								})}
							</tr>
						);
					})}
				</tbody>
				{(firstTotal >= 0 || footer) && (
					<tfoot>
						{firstTotal >= 0 && (
							<tr className='data-table-total'>
								{firstTotal > 0 && (
									<td className='data-table-total-label' colSpan={firstTotal}>{totalLabel}</td>
								)}
								{columns.slice(firstTotal).map((column) => {
									return (
										<td key={column.key} className={cellClassName(column as DataTableColumn<unknown>)}>
											{column.total}
										</td>
									);
								})}
							</tr>
						)}
						{footer && (
							<tr>
								<td colSpan={columns.length}>{footer}</td>
							</tr>
						)}
					</tfoot>
				)}
			</table>
		</div>
	);
};
