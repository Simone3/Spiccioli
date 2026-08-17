import type { ReactElement, ReactNode } from 'react';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { isReadImportRow, type ImportRefusal, type ImportRow } from 'src/logic/transactions/TransactionImport';
import type { DateFormat } from 'src/types/PreferencesTypes';

/**
 * The preview: every pasted row as the controls read it, with what is about to happen to it stated on the row itself.
 *
 * **Every readable row arrives ticked.** A row the file already holds is flagged and arrives unticked — it can be ticked again,
 * the flag unselecting it rather than locking it — and **a row that cannot be read cannot be ticked at all** and carries the
 * reason instead of a figure.
 */

export interface ImportPreviewTableProps {

	// Every row of the paste, in the order it was pasted
	rows: readonly ImportRow[];

	// The lines the file already holds a transaction for
	duplicates: ReadonlySet<number>;

	// The lines that are ticked, which are the ones the import writes
	selection: ReadonlySet<number>;

	// The order the dates were read under, which is what a refused date names
	dateFormat: DateFormat;

	onToggleRow: (line: number) => void;
}

/**
 * The preview table.
 * @param props The table's props.
 * @param props.rows The rows of the paste.
 * @param props.duplicates The lines the file already holds.
 * @param props.selection The lines that are ticked.
 * @param props.dateFormat The order the dates were read under.
 * @param props.onToggleRow What ticking a row does.
 * @returns The table.
 */
export const ImportPreviewTable = ({ rows, duplicates, selection, dateFormat, onToggleRow }: ImportPreviewTableProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	const refusalText = (refusal: ImportRefusal): string => {
		switch(refusal.reason) {
			case 'columns':
				return t('import.refusal.columns', { count: refusal.columns });
			case 'date':
				return t('import.refusal.date', { dateFormat });
			case 'futureDate':
				return t('import.refusal.futureDate');
			case 'amount':
				return t('import.refusal.amount');
			default:
				return t('import.refusal.description');
		}
	};

	const statusOf = (row: ImportRow): ReactNode => {
		if(!isReadImportRow(row)) {
			return (
				<span className='bulk-import-screen-refused'>
					{t('import.statusUnreadable', { reason: refusalText(row.refusal) })}
				</span>
			);
		}

		if(duplicates.has(row.line)) {
			return <span className='bulk-import-screen-refused'>{t('import.statusDuplicate')}</span>;
		}

		return <span className='bulk-import-screen-new'>{t('import.statusNew')}</span>;
	};

	const amountOf = (row: ImportRow): ReactNode => {
		if(!isReadImportRow(row)) {
			return <span className='bulk-import-screen-raw'>{row.amount || t('table.notApplicable')}</span>;
		}

		return (
			<span className={row.values.amount < 0 ? 'bulk-import-screen-negative' : 'bulk-import-screen-positive'}>
				{formatter.amount(row.values.amount, true)}
			</span>
		);
	};

	const columns: readonly DataTableColumn<ImportRow>[] = [
		{
			key: 'selection',
			header: '',
			render: (row) => {
				const readable = isReadImportRow(row);

				return (
					<input
						type='checkbox'
						className='data-table-checkbox'
						checked={selection.has(row.line)}
						disabled={!readable}
						aria-label={readable ? t('import.select', { line: row.line }) : t('import.cannotSelect', { line: row.line })}
						onChange={() => {
							onToggleRow(row.line);
						}}/>
				);
			}
		},
		{
			key: 'date',
			header: t('import.columns.date'),
			numeric: true,
			render: (row) => {
				return isReadImportRow(row) ?
					formatter.storedDate(row.values.date) :
					<span className='bulk-import-screen-raw'>{row.date || t('table.notApplicable')}</span>;
			}
		},
		{
			key: 'description',
			header: t('import.columns.description'),
			render: (row) => {
				return isReadImportRow(row) ?
					row.values.description :
					<span className='bulk-import-screen-raw'>{row.description || t('table.notApplicable')}</span>;
			}
		},
		{
			key: 'amount',
			header: t('import.columns.amount'),
			numeric: true,
			render: amountOf
		},
		{
			key: 'status',
			header: t('import.columns.status'),
			render: statusOf
		}
	];

	return (
		<DataTable
			columns={columns}
			rows={rows}
			label={t('import.table')}
			getRowKey={(row) => {
				return String(row.line);
			}}
			getRowClassName={(row) => {
				return isReadImportRow(row) ? undefined : 'bulk-import-screen-row-unreadable';
			}}/>
	);
};
