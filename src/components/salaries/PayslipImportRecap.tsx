import { useEffect, useId, useRef, type ReactElement, type ReactNode } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import {
	isWritablePayslipRow,
	type PayslipBatchPeriod,
	type PayslipBatchRefusal,
	type PayslipBatchRow
} from 'src/logic/salaries/PayslipImportBatch';
import { netSalary } from 'src/logic/salaries/Payslips';
import type { Contract } from 'src/types/LedgerTypes';

/**
 * The recap a selection of several payslip documents opens instead of a form ([§8.1](../../../docs/functional/specs/08-salaries.md#81-payslips)).
 *
 * **It is a list and not a form.** Every document has a row, a row states the payslip it would write in full — the month, the
 * label and every figure the payslip table carries — and there is nothing on it to type into. What is written is what is shown,
 * and a figure that should have been something else is corrected on the row's own form once it is there.
 *
 * **A document that cannot be read is a marked row and never the end of the selection.** It says which refusal it was, it
 * cannot be ticked, and it leaves every row around it exactly as it was — the rule the bulk import's unreadable rows follow.
 *
 * **A duplicate is unticked and not untickable.** A month legitimately holds more than one payslip, so a row matching one the
 * file already holds, or an earlier row of this selection, can be ticked again by somebody who means it.
 */

// A month is written with both of its digits wherever it is named
const MONTH_DIGITS = 2;

export interface PayslipImportRecapProps {

	// The contract the selection is read against, which the panel names under its title
	contract: Contract;

	// What the selection was read under, already named out of the bundle
	templateName: string;

	// One row per document, ordered the way the payslip table orders its own
	rows: readonly PayslipBatchRow[];

	// The rows that will be written
	ticked: ReadonlySet<string>;

	onToggle: (key: string) => void;
	onTickAll: (all: boolean) => void;
	onCancel: () => void;
	onSave: () => void;
}

/**
 * The recap.
 * @param props The recap's props.
 * @param props.contract The contract the payslips would land under.
 * @param props.templateName What the documents were read under.
 * @param props.rows One row per document.
 * @param props.ticked The rows that will be written.
 * @param props.onToggle What ticking a row does.
 * @param props.onTickAll What the two selectors do.
 * @param props.onCancel What closing without writing does.
 * @param props.onSave What writing the ticked rows does.
 * @returns The recap.
 */
export const PayslipImportRecap = ({
	contract,
	templateName,
	rows,
	ticked,
	onToggle,
	onTickAll,
	onCancel,
	onSave
}: PayslipImportRecapProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const titleId = useId();
	const panelRef = useRef<HTMLDivElement>(null);

	// The keyboard opens on the first row that can be ticked, and on the panel itself where there is no such row
	useEffect(() => {
		const panel = panelRef.current;

		(panel?.querySelector<HTMLElement>('input:not([disabled])') ?? panel)?.focus();
	}, []);

	const writable = rows.filter(isWritablePayslipRow);
	const tickedCount = rows.filter((row) => {
		return ticked.has(row.key);
	}).length;

	const periodOf = (row: PayslipBatchRow): PayslipBatchPeriod | undefined => {
		return row.outcome === 'read' ? row.values : row.period;
	};

	const refusalText = (refusal: PayslipBatchRefusal): string => {
		if(refusal.reason === 'file') {
			if(refusal.refusal.reason === 'empty') {
				return t('payslips.import.batch.refusals.noText');
			}

			return t(`payslips.import.batch.refusals.${refusal.refusal.reason === 'not-a-pdf' ? 'notAPdf' : 'unreadable'}`);
		}

		if(refusal.reason === 'year-outside-contract') {
			return t('payslips.import.batch.refusals.yearOutsideContract', { year: String(refusal.year) });
		}

		if(refusal.reason === 'gross-missing') {
			return t('payslips.import.batch.refusals.grossMissing', {
				figures: refusal.figures.map((figure) => {
					return t(`payslips.form.${figure}`);
				}).join(', ')
			});
		}

		if(refusal.reason === 'month-outside-contract') {
			return t('payslips.import.batch.refusals.monthOutsideContract');
		}

		return t(`payslips.import.batch.refusals.${refusal.reason === 'no-text' ? 'noText' : 'periodMissing'}`);
	};

	// What the row would do to the file, which is the one column a recap exists for
	const statusOf = (row: PayslipBatchRow): ReactNode => {
		if(row.outcome === 'refused') {
			return <span className='salaries-screen-refused'>{refusalText(row.refusal)}</span>;
		}

		const zeroed = row.zeroed.length === 0 ?
			undefined :
			<span className='salaries-screen-quiet'>{t('payslips.import.batch.statusZeroed', { count: row.zeroed.length })}</span>;

		if(row.duplicate !== 'none') {
			return (
				<>
					<span className='salaries-screen-refused'>
						{t(row.duplicate === 'file' ? 'payslips.import.batch.statusDuplicate' : 'payslips.import.batch.statusDuplicateInSelection')}
					</span>
					{zeroed && <> {zeroed}</>}
				</>
			);
		}

		return (
			<>
				<Chip tone='accent'>{t('payslips.import.batch.statusNew')}</Chip>
				{zeroed && <> {zeroed}</>}
			</>
		);
	};

	// A figure is written where the row would write one, and a row that would write nothing writes nothing here either
	const amountColumn = (key: string, header: string, figure: (row: PayslipBatchRow) => number | undefined): DataTableColumn<PayslipBatchRow> => {
		return {
			key,
			header,
			numeric: true,
			render: (row) => {
				const value = figure(row);

				return value === undefined ?
					<span className='salaries-screen-quiet'>{t('table.notApplicable')}</span> :
					formatter.amount(value);
			}
		};
	};

	// The figure as the row would write it, which is nothing at all on a row that cannot be written
	const written = (row: PayslipBatchRow, read: (values: PayslipBatchRow & { outcome: 'read' }) => number): number | undefined => {
		return row.outcome === 'read' ? read(row) : undefined;
	};

	// A row with nothing under any of the three headings states the one zero rather than three of them, exactly as the table does
	const pensionFundCell = (row: PayslipBatchRow): ReactNode => {
		if(row.outcome !== 'read') {
			return <span className='salaries-screen-quiet'>{t('table.notApplicable')}</span>;
		}

		const { employeeContribution, employerContribution, severanceContribution } = row.values;

		if([ employeeContribution, employerContribution, severanceContribution ].every((credit) => {
			return credit === 0;
		})) {
			return formatter.amount(0);
		}

		return t('payslips.pensionFundSum', {
			employee: formatter.amount(employeeContribution),
			employer: formatter.amount(employerContribution),
			severance: formatter.amount(severanceContribution)
		});
	};

	const columns: readonly DataTableColumn<PayslipBatchRow>[] = [
		{
			key: 'selection',
			header: (
				<input
					type='checkbox'
					className='data-table-checkbox'
					checked={writable.length > 0 && tickedCount === writable.length}
					disabled={writable.length === 0}
					aria-label={t('payslips.import.batch.tickAll')}
					onChange={() => {
						onTickAll(tickedCount !== writable.length);
					}}/>
			),
			render: (row) => {
				const canWrite = isWritablePayslipRow(row);

				return (
					<input
						type='checkbox'
						className='data-table-checkbox'
						checked={ticked.has(row.key)}
						disabled={!canWrite}
						aria-label={t(canWrite ? 'payslips.import.batch.select' : 'payslips.import.batch.cannotSelect', { document: row.fileName })}
						onChange={() => {
							onToggle(row.key);
						}}/>
				);
			}
		},
		{
			key: 'document',
			header: t('payslips.import.batch.columns.document'),
			render: (row) => {
				return <span className='salaries-screen-document'>{row.fileName}</span>;
			}
		},
		{
			key: 'month',
			header: t('payslips.columns.month'),
			render: (row) => {
				const period = periodOf(row);

				return period === undefined ?
					<span className='salaries-screen-quiet'>{t('table.notApplicable')}</span> :
					t('payslips.monthOfYear', {
						month: String(period.month).padStart(MONTH_DIGITS, '0'),
						year: String(period.year)
					});
			}
		},
		{
			key: 'label',
			header: t('payslips.columns.label'),
			render: (row) => {
				const label = periodOf(row)?.label ?? null;

				return label === null ?
					<span className='salaries-screen-quiet'>{t('table.notApplicable')}</span> :
					<Chip tone='accent'>{label}</Chip>;
			}
		},
		amountColumn('contractGross', t('payslips.columns.contractGross'), (row) => {
			return written(row, (read) => {
				return read.values.contractGross;
			});
		}),
		amountColumn('gross', t('payslips.columns.gross'), (row) => {
			return written(row, (read) => {
				return read.values.gross;
			});
		}),
		amountColumn('netPayment', t('payslips.columns.netPayment'), (row) => {
			return written(row, (read) => {
				return read.values.netPayment;
			});
		}),
		amountColumn('refunds', t('payslips.columns.refunds'), (row) => {
			return written(row, (read) => {
				return read.values.refunds;
			});
		}),
		amountColumn('carPayment', t('payslips.columns.carPayment'), (row) => {
			return written(row, (read) => {
				return read.values.carPayment;
			});
		}),

		// The one derived column, sitting where the payslip table puts it: beside the three figures it is made of
		amountColumn('netSalary', t('payslips.columns.netSalary'), (row) => {
			return written(row, (read) => {
				return netSalary(read.values);
			});
		}),
		{
			key: 'pensionFund',
			header: t('payslips.columns.pensionFund'),
			numeric: true,
			render: pensionFundCell
		},
		{
			key: 'status',
			header: t('payslips.import.batch.columns.status'),
			render: statusOf
		}
	];

	return (
		<div
			className='payslip-recap-overlay'
			role='presentation'
			onKeyDown={(event) => {
				if(event.key === 'Escape') {
					onCancel();
				}
			}}>
			<div className='payslip-recap-panel' role='dialog' aria-modal='true' aria-labelledby={titleId} ref={panelRef} tabIndex={-1}>
				<div className='payslip-recap-heading'>
					<h2 className='payslip-recap-title' id={titleId}>{t('payslips.import.batch.title')}</h2>
					<span className='payslip-recap-subtitle'>
						{t('payslips.import.batch.subtitle', {
							contract: contract.name,
							template: templateName,
							documents: t('payslips.import.batch.documentCount', { count: rows.length })
						})}
					</span>
				</div>

				<p className='payslip-recap-notice'>{t('payslips.import.batch.notice')}</p>

				<div className='payslip-recap-selectors'>
					<span className='payslip-recap-selectors-label'>{t('payslips.import.batch.selectLabel')}</span>
					<AppButton
						disabled={writable.length === 0}
						onClick={() => {
							onTickAll(true);
						}}>
						{t('payslips.import.batch.selectors.writable')}
					</AppButton>
					<AppButton
						disabled={tickedCount === 0}
						onClick={() => {
							onTickAll(false);
						}}>
						{t('payslips.import.batch.selectors.none')}
					</AppButton>
				</div>

				<DataTable
					columns={columns}
					rows={rows}
					label={t('payslips.import.batch.table')}
					footer={writable.length === 0 ?
						t('payslips.import.batch.nothingToWrite') :
						t('payslips.import.batch.footer', {
							ticked: t('payslips.import.batch.payslipCount', { count: tickedCount }),
							documents: t('payslips.import.batch.documentCount', { count: rows.length })
						})}
					getRowClassName={(row) => {
						return isWritablePayslipRow(row) ? undefined : 'payslip-recap-row-quiet';
					}}
					getRowKey={(row) => {
						return row.key;
					}}/>

				<div className='payslip-recap-actions'>
					<AppButton variant='ghost' onClick={onCancel}>{t('dialog.cancel')}</AppButton>
					<AppButton variant='primary' disabled={tickedCount === 0} onClick={onSave}>
						{t('payslips.import.batch.save', { count: tickedCount })}
					</AppButton>
				</div>
			</div>
		</div>
	);
};
