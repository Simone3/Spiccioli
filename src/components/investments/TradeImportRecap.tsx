import type { ReactElement, ReactNode } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { Chip } from 'src/components/common/Chip';
import type { DataTableColumn } from 'src/components/common/DataTable';
import { ImportRecap } from 'src/components/import/ImportRecap';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { isWritableTradeImportRow, type TradeImportRefusal, type TradeImportRow, type TradeImportValues } from 'src/logic/investments/TradeImport';
import { tradeTotal } from 'src/logic/investments/Trades';
import type { DateFormat } from 'src/types/PreferencesTypes';
import type { LedgerId, Security } from 'src/types/LedgerTypes';

/**
 * The recap a broker's export opens before anything is written ([§7.7](../../../docs/functional/specs/07-investments.md#77-importing-trades)).
 *
 * **It is a list and not a form.** Every row states the trade it would write — the day, the kind, the security, the figures and
 * the total — and the one thing that can be done to a row besides ticking it is **creating the security it needs**, on the
 * ordinary security form. There is no picking another security instead: a row either matches one or creates one.
 *
 * **A row that cannot be written is stated rather than hidden**, carrying what the export printed where it could not be read,
 * and the rows that were not trades at all are only counted, above the table.
 */

export interface TradeImportRecapProps {

	// What was read, and into what, already named: the account, the template and the file
	accountName: string;
	templateName: string;
	fileName: string;

	// What the template says its dates are written as, which is what a date that could not be read is said not to be
	dateFormat: DateFormat;

	rows: readonly TradeImportRow[];

	// How many rows of the export were not trades
	dropped: number;

	// What a matched row's security is called: the file's securities and the ones the recap has created
	securities: ReadonlyMap<LedgerId, Security>;

	// The rows that will be written
	ticked: ReadonlySet<string>;

	onToggle: (key: string) => void;
	onTickAll: (all: boolean) => void;

	// What *Create security…* on a row does
	onCreateSecurity: (row: TradeImportRow) => void;

	onCancel: () => void;
	onSave: () => void;
}

/**
 * The recap.
 * @param props The recap's props.
 * @param props.accountName The account the trades would land in.
 * @param props.templateName What the export was read under.
 * @param props.fileName The export.
 * @param props.dateFormat What the template says its dates are written as.
 * @param props.rows One row per trade of the export.
 * @param props.dropped How many rows were not trades.
 * @param props.securities What a matched row's security is called.
 * @param props.ticked The rows that will be written.
 * @param props.onToggle What ticking a row does.
 * @param props.onTickAll What the two selectors do.
 * @param props.onCreateSecurity What creating a row's security does.
 * @param props.onCancel What closing without writing does.
 * @param props.onSave What writing the ticked rows does.
 * @returns The recap.
 */
export const TradeImportRecap = ({
	accountName,
	templateName,
	fileName,
	dateFormat,
	rows,
	dropped,
	securities,
	ticked,
	onToggle,
	onTickAll,
	onCreateSecurity,
	onCancel,
	onSave
}: TradeImportRecapProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	const writable = rows.filter(isWritableTradeImportRow);
	const tickedCount = rows.filter((row) => {
		return ticked.has(row.key);
	}).length;
	const zeroedCount = rows.filter((row) => {
		return row.outcome !== 'refused' && row.values.zeroed.length > 0;
	}).length;
	const waitingCount = rows.filter((row) => {
		return row.outcome === 'newSecurity';
	}).length;

	const valuesOf = (row: TradeImportRow): TradeImportValues | undefined => {
		return row.outcome === 'refused' ? undefined : row.values;
	};

	// A figure is written where the row would write one, and what the export printed where it could not be read
	const figureColumn = (
		key: string,
		header: string,
		written: (values: TradeImportValues) => string,
		printed: (row: TradeImportRow) => string
	): DataTableColumn<TradeImportRow> => {
		return {
			key,
			header,
			numeric: true,
			render: (row) => {
				const values = valuesOf(row);

				if(values) {
					return written(values);
				}

				return <span className='investments-screen-quiet'>{printed(row) || t('table.notApplicable')}</span>;
			}
		};
	};

	const refusalText = (refusal: TradeImportRefusal): string => {
		if(refusal.reason === 'tickerAmbiguous') {
			return t('trades.import.recap.refusals.tickerAmbiguous', { count: refusal.count });
		}

		if(refusal.reason === 'date') {
			return t('trades.import.recap.refusals.date', { dateFormat });
		}

		return t(`trades.import.recap.refusals.${refusal.reason}`);
	};

	// The figures a row writes as zeros, named rather than counted: there are two of them at most
	const zeroedText = (values: TradeImportValues): ReactNode => {
		if(values.zeroed.length === 0) {
			return undefined;
		}

		const figures = values.zeroed.map((figure) => {
			return t(`trades.import.recap.zeroedFigures.${figure}`);
		}).join(', ');

		return <> <span className='investments-screen-quiet'>{t('trades.import.recap.statusZeroed', { figures })}</span></>;
	};

	// What the row would do to the file, which is the one column a recap exists for
	const statusOf = (row: TradeImportRow): ReactNode => {
		if(row.outcome === 'refused') {
			return <span className='investments-screen-negative'>{refusalText(row.refusal)}</span>;
		}

		if(row.outcome === 'newSecurity') {
			return (
				<div className='investments-screen-import-status'>
					<span className='investments-screen-nothing'>{t('trades.import.recap.statusNewSecurity')}</span>
					<AppButton
						label={t('trades.import.recap.createSecurityLabel', { line: row.cells.line })}
						onClick={() => {
							onCreateSecurity(row);
						}}>
						{t('trades.import.recap.createSecurity')}
					</AppButton>
				</div>
			);
		}

		const differs = row.tickerDiffers ?
			<> <span className='investments-screen-quiet'>{t('trades.import.recap.statusTickerDiffers', { ticker: row.cells.ticker })}</span></> :
			undefined;

		return (
			<>
				{row.duplicate ?
					<span className='investments-screen-negative'>{t('trades.import.recap.statusDuplicate')}</span> :
					<Chip tone='accent'>{t('trades.import.recap.statusNew')}</Chip>}
				{zeroedText(row.values)}
				{differs}
			</>
		);
	};

	const securityCell = (row: TradeImportRow): ReactNode => {
		const security = row.outcome === 'read' ? securities.get(row.securityId) : undefined;

		if(security) {
			return (
				<>
					{security.ticker} <span className='investments-screen-quiet'>{security.name}</span>
				</>
			);
		}

		// Nothing matched, or the row could not be read: what the export printed, the ISIN where there is one
		const printed = [ row.cells.ticker, row.cells.isin ].filter((part) => {
			return part !== '';
		}).join(' · ');

		return <span className='investments-screen-quiet'>{printed || t('table.notApplicable')}</span>;
	};

	const columns: readonly DataTableColumn<TradeImportRow>[] = [
		{
			key: 'line',
			header: t('trades.import.recap.columns.line'),
			numeric: true,
			render: (row) => {
				return <span className='investments-screen-quiet'>{formatter.integer(row.cells.line)}</span>;
			}
		},
		{
			key: 'date',
			header: t('trades.columns.date'),
			render: (row) => {
				const values = valuesOf(row);

				return values ? formatter.storedDate(values.date) : <span className='investments-screen-quiet'>{row.cells.date || t('table.notApplicable')}</span>;
			}
		},
		{
			key: 'kind',
			header: t('trades.import.recap.columns.kind'),
			render: (row) => {
				return t(`trades.import.recap.kinds.${row.cells.kind}`);
			}
		},
		{
			key: 'security',
			header: t('trades.columns.security'),
			render: securityCell
		},
		figureColumn('quantity', t('trades.columns.quantity'), (values) => {
			return formatter.quantity(values.quantity);
		}, (row) => {
			return row.cells.quantity;
		}),
		figureColumn('unitPrice', t('trades.columns.unitPrice'), (values) => {
			return formatter.unitPrice(values.unitPrice);
		}, (row) => {
			return row.cells.unitPrice;
		}),
		figureColumn('fees', t('trades.columns.fees'), (values) => {
			return formatter.amount(values.fees);
		}, (row) => {
			return row.cells.fees;
		}),

		// A purchase carries no tax, so the cell says so rather than printing a zero nobody asked for
		{
			key: 'taxes',
			header: t('trades.columns.taxes'),
			numeric: true,
			render: (row) => {
				const values = valuesOf(row);

				if(row.cells.kind === 'purchase') {
					return <span className='investments-screen-quiet'>{t('table.notApplicable')}</span>;
				}

				return values ? formatter.amount(values.taxes) : <span className='investments-screen-quiet'>{row.cells.taxes || t('table.notApplicable')}</span>;
			}
		},
		{
			key: 'total',
			header: t('trades.import.recap.columns.total'),
			numeric: true,
			render: (row) => {
				const values = valuesOf(row);

				return values ?
					formatter.amount(tradeTotal({ ...values, kind: row.cells.kind })) :
					<span className='investments-screen-quiet'>{t('table.notApplicable')}</span>;
			}
		},
		{
			key: 'status',
			header: t('trades.import.recap.columns.status'),
			render: statusOf
		}
	];

	const notices: ReactNode[] = [
		t('trades.import.recap.notice'),
		...dropped > 0 ? [ t('trades.import.recap.droppedNotice', { count: dropped }) ] : [],
		...waitingCount > 0 ? [ t('trades.import.recap.newSecurityNotice', { count: waitingCount }) ] : [],
		...zeroedCount > 0 ? [ t('trades.import.recap.zeroedNotice', { count: zeroedCount }) ] : []
	];

	const footer = (): string => {
		if(writable.length === 0) {
			return waitingCount > 0 ? t('trades.import.recap.nothingYet') : t('trades.import.recap.nothingToWrite');
		}

		return t('trades.import.recap.footer', {
			ticked: t('trades.import.recap.tradeCount', { count: tickedCount }),
			rows: t('trades.import.recap.rowCount', { count: rows.length })
		});
	};

	return (
		<ImportRecap
			title={t('trades.import.recap.title')}
			subtitle={t('trades.import.recap.subtitle', { account: accountName, template: templateName, fileName })}
			notices={notices}
			columns={columns}
			rows={rows}
			getRowKey={(row) => {
				return row.key;
			}}
			isWritable={isWritableTradeImportRow}
			selectLabel={(row, canWrite) => {
				const { line } = row.cells;

				return canWrite ? t('trades.import.recap.select', { line }) : t('trades.import.recap.cannotSelect', { line });
			}}
			tickAllLabel={t('trades.import.recap.tickAll')}
			tableLabel={t('trades.import.recap.table')}
			footer={footer()}
			ticked={ticked}
			onToggle={onToggle}
			onTickAll={onTickAll}
			saveLabel={t('trades.import.recap.save', { count: tickedCount })}
			onSave={onSave}
			onCancel={onCancel}/>
	);
};
