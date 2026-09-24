import 'src/components/import/ImportRecap.css';
import { useEffect, useId, useRef, type ReactElement, type ReactNode } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * The panel an import states what it would write in, before anything is ([§7.7](../../../docs/functional/specs/07-investments.md#77-importing-trades),
 * [§8.1](../../../docs/functional/specs/08-salaries.md#81-payslips)).
 *
 * **It is a list and not a form.** Every row states the record it would write and carries a tick, the two selectors set the whole
 * selection at once, and one press writes the ticked rows — nothing on it is typed into. **A row that cannot be written is stated
 * rather than hidden**, quieter than the rest and with no tick to offer.
 *
 * **It knows nothing about what a row is.** The columns, the wording and which rows can be written are the import's; what is
 * here is the panel around them, which is the same panel whichever import opened it.
 */

export interface ImportRecapProps<Row> {
	title: string;

	// What was read, and under what: the account or contract, the template, the file
	subtitle: string;

	// What the recap says about itself before the rows: that nothing is written yet, and what a zero in them means
	notices: readonly ReactNode[];

	// Every column but the tick, which the panel draws itself
	columns: readonly DataTableColumn<Row>[];
	rows: readonly Row[];
	getRowKey: (row: Row) => string;

	// Whether a row can be ticked at all
	isWritable: (row: Row) => boolean;

	// What a row's tick is called, for a row that can be written and for one that cannot
	selectLabel: (row: Row, writable: boolean) => string;

	// What the tick above the column is called
	tickAllLabel: string;

	tableLabel: string;
	footer: ReactNode;

	// The rows that will be written
	ticked: ReadonlySet<string>;

	onToggle: (key: string) => void;
	onTickAll: (all: boolean) => void;

	// What the press that writes them says, with the count in it
	saveLabel: string;

	onSave: () => void;
	onCancel: () => void;
}

/**
 * The recap.
 * @param props The recap's props.
 * @param props.title What the panel is called.
 * @param props.subtitle What was read, and under what.
 * @param props.notices What the recap says about itself before the rows.
 * @param props.columns Every column but the tick.
 * @param props.rows The rows.
 * @param props.getRowKey What a row is remembered by.
 * @param props.isWritable Whether a row can be ticked.
 * @param props.selectLabel What a row's tick is called.
 * @param props.tickAllLabel What the tick above the column is called.
 * @param props.tableLabel What the table is called.
 * @param props.footer What is said under the table.
 * @param props.ticked The rows that will be written.
 * @param props.onToggle What ticking a row does.
 * @param props.onTickAll What the two selectors do.
 * @param props.saveLabel What the press that writes says.
 * @param props.onSave What writing the ticked rows does.
 * @param props.onCancel What closing without writing does.
 * @returns The recap.
 */
export const ImportRecap = <Row, >({
	title,
	subtitle,
	notices,
	columns,
	rows,
	getRowKey,
	isWritable,
	selectLabel,
	tickAllLabel,
	tableLabel,
	footer,
	ticked,
	onToggle,
	onTickAll,
	saveLabel,
	onSave,
	onCancel
}: ImportRecapProps<Row>): ReactElement => {
	const { t } = useTranslator();
	const titleId = useId();
	const panelRef = useRef<HTMLDivElement>(null);

	// The keyboard opens on the first row that can be ticked, and on the panel itself where there is no such row
	useEffect(() => {
		const panel = panelRef.current;

		(panel?.querySelector<HTMLElement>('input:not([disabled])') ?? panel)?.focus();
	}, []);

	const writable = rows.filter(isWritable);
	const tickedCount = rows.filter((row) => {
		return ticked.has(getRowKey(row));
	}).length;

	const selectionColumn: DataTableColumn<Row> = {
		key: 'selection',
		header: (
			<input
				type='checkbox'
				className='data-table-checkbox'
				checked={writable.length > 0 && tickedCount === writable.length}
				disabled={writable.length === 0}
				aria-label={tickAllLabel}
				onChange={() => {
					onTickAll(tickedCount !== writable.length);
				}}/>
		),
		render: (row) => {
			const canWrite = isWritable(row);
			const key = getRowKey(row);

			return (
				<input
					type='checkbox'
					className='data-table-checkbox'
					checked={ticked.has(key)}
					disabled={!canWrite}
					aria-label={selectLabel(row, canWrite)}
					onChange={() => {
						onToggle(key);
					}}/>
			);
		}
	};

	return (
		<div
			className='import-recap-overlay'
			role='presentation'
			onKeyDown={(event) => {
				if(event.key === 'Escape') {
					onCancel();
				}
			}}>
			<div className='import-recap-panel' role='dialog' aria-modal='true' aria-labelledby={titleId} ref={panelRef} tabIndex={-1}>
				<div className='import-recap-heading'>
					<h2 className='import-recap-title' id={titleId}>{title}</h2>
					<span className='import-recap-subtitle'>{subtitle}</span>
				</div>

				{notices.map((notice, index) => {
					// The notices are fixed in number and order for as long as the panel is up, so their position is who they are
					return <p key={index} className='import-recap-notice'>{notice}</p>;
				})}

				<div className='import-recap-selectors'>
					<span className='import-recap-selectors-label'>{t('importRecap.selectLabel')}</span>
					<AppButton
						disabled={writable.length === 0}
						onClick={() => {
							onTickAll(true);
						}}>
						{t('importRecap.selectors.writable')}
					</AppButton>
					<AppButton
						disabled={tickedCount === 0}
						onClick={() => {
							onTickAll(false);
						}}>
						{t('importRecap.selectors.none')}
					</AppButton>
				</div>

				<DataTable
					columns={[ selectionColumn, ...columns ]}
					rows={rows}
					label={tableLabel}
					footer={footer}
					getRowClassName={(row) => {
						return isWritable(row) ? undefined : 'import-recap-row-quiet';
					}}
					getRowKey={getRowKey}/>

				<div className='import-recap-actions'>
					<AppButton variant='ghost' onClick={onCancel}>{t('dialog.cancel')}</AppButton>
					<AppButton variant='primary' disabled={tickedCount === 0} onClick={onSave}>{saveLabel}</AppButton>
				</div>
			</div>
		</div>
	);
};
