import 'src/components/common/DataTable.css';
import type { ReactElement, ReactNode } from 'react';

/**
 * The one table, and the footer every table that totals something carries.
 *
 * A column says how it is read rather than how it is drawn: a numeric column aligns right and uses tabular figures, so a column
 * of amounts lines up on its decimal place. **A zero is not an empty state** and renders like any other figure; a screen with
 * nothing to put in the table shows the empty state instead of the table's own headers.
 */

export interface DataTableColumn<TRow> {
	key: string;
	header: string;

	// Right-aligned, in tabular figures: every amount, quantity, price and count
	numeric?: boolean;

	render: (row: TRow) => ReactNode;
}

export interface DataTableProps<TRow> {
	columns: readonly DataTableColumn<TRow>[];
	rows: readonly TRow[];
	getRowKey: (row: TRow) => string;

	// What the table is called, for whoever is not looking at the heading above it
	label: string;

	// The line under the rule: counts, totals, whatever the screen's own specification says goes there
	footer?: ReactNode;
}

const cellClassName = (column: DataTableColumn<unknown>): string | undefined => {
	return column.numeric ? 'data-table-right data-table-numeric' : undefined;
};

/**
 * The one table.
 * @param props The table's props.
 * @param props.columns The columns, in the order they are shown.
 * @param props.rows The rows, already in the order the screen's specification fixes.
 * @param props.getRowKey What tells two rows apart.
 * @param props.label What the table is called.
 * @param props.footer What goes under the rule, where there is anything.
 * @returns The table.
 */
export const DataTable = <TRow, >({ columns, rows, getRowKey, label, footer }: DataTableProps<TRow>): ReactElement => {
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
							<tr key={getRowKey(row)}>
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
				{footer && (
					<tfoot>
						<tr>
							<td colSpan={columns.length}>{footer}</td>
						</tr>
					</tfoot>
				)}
			</table>
		</div>
	);
};
