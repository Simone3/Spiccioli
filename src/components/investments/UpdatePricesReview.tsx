import type { ReactElement, ReactNode } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { summarisePriceWrites, type PriceUpdateEntry, type PriceUpdateProblem, type PriceUpdateRow } from 'src/logic/investments/PriceUpdate';
import type { LedgerId } from 'src/types/LedgerTypes';

/**
 * The second page of the modal, which is one page and not two: the table is drawn when the pass starts and fills in row by row,
 * so nothing is redrawn or re-ordered when the last answer lands.
 *
 * **Every security in the file has a row**, in the order the first page listed them — the ones that were never ticked included,
 * so that the page accounts for all of them rather than quietly listing a subset.
 *
 * **A row says what writing it would do to the file**: the days it holds no price for, the days that would land on a different
 * value, and the days that already hold exactly what came back and are therefore not written at all. **The replacements can be
 * read**, since they are the only writes that take something away; the new days cannot, there being thousands of them and
 * nothing under them.
 */

export interface UpdatePricesReviewProps {

	// Every security in the file, ordered by ticker, in whatever state the pass has left it
	entries: readonly PriceUpdateEntry[];

	// The moment the provider's figures are as of, where it states one
	referenceDate: string | undefined;

	// Whether the pass is still running, which is what keeps every control but Cancel dead
	running: boolean;

	// How far the pass has got, and which listing it is waiting on
	done: number;
	total: number;
	askingTicker: string | undefined;

	// The securities asking again could come back differently for, which is only ever a request that did not complete
	retryableCount: number;

	ticked: ReadonlySet<LedgerId>;
	onToggle: (securityId: LedgerId) => void;
	onTickAll: (all: boolean) => void;

	expanded: ReadonlySet<LedgerId>;
	onExpand: (securityId: LedgerId) => void;

	// Back to the first page, keeping the choice and discarding what came back
	onBack: () => void;

	onRetry: () => void;
	onCancel: () => void;
	onConfirm: () => void;
}

const isWritable = (entry: PriceUpdateEntry): boolean => {
	return entry.state === 'quoted' && entry.row.writes.length > 0;
};

/**
 * The reviewing page.
 * @param props The page's props.
 * @param props.entries Every security in the file, in whatever state the pass has left it.
 * @param props.referenceDate The moment the provider's figures are as of.
 * @param props.running Whether the pass is still running.
 * @param props.done How many listings have been answered.
 * @param props.total How many were asked about.
 * @param props.askingTicker The listing the pass is waiting on.
 * @param props.retryableCount How many securities asking again could answer differently for.
 * @param props.ticked Which rows will be written.
 * @param props.onToggle What ticking a row does.
 * @param props.onTickAll What the two selectors do.
 * @param props.expanded Which rows are showing their replacements.
 * @param props.onExpand What opening a row's replacements does.
 * @param props.onBack What going back to the first page does.
 * @param props.onRetry What asking again does.
 * @param props.onCancel What closing without writing does.
 * @param props.onConfirm What writing does.
 * @returns The page.
 */
export const UpdatePricesReview = ({
	entries,
	referenceDate,
	running,
	done,
	total,
	askingTicker,
	retryableCount,
	ticked,
	onToggle,
	onTickAll,
	expanded,
	onExpand,
	onBack,
	onRetry,
	onCancel,
	onConfirm
}: UpdatePricesReviewProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	const writable = entries.filter(isWritable);
	const tickedRows = entries.flatMap((entry): PriceUpdateRow[] => {
		return entry.state === 'quoted' && ticked.has(entry.security.id) ? [ entry.row ] : [];
	});
	const summary = summarisePriceWrites(tickedRows);

	const problemReason = (problem: PriceUpdateProblem): string => {
		if(problem.reason === 'no-quote') {
			return t('updatePrices.reasons.noQuote');
		}

		if(problem.reason === 'failed') {
			return t('updatePrices.reasons.failed', { message: problem.message });
		}

		if(problem.refusal === 'not-euro') {
			return t('updatePrices.reasons.notEuro', { currency: problem.currency ?? '' });
		}

		if(problem.refusal === 'future-date') {
			return t('updatePrices.reasons.futureDate');
		}

		return problem.refusal === 'not-positive' ? t('updatePrices.reasons.notPositive') : t('updatePrices.reasons.noCurrency');
	};

	// What the row says came back: the days, split into the three things writing them would do to the file
	const countsOf = (row: PriceUpdateRow): ReactNode => {
		return (
			<>
				<span className='update-prices-days'>{t('updatePrices.daysBack', { count: row.days.length })}</span>
				{row.newCount > 0 && <Chip tone='accent'>{t('updatePrices.newDays', { count: row.newCount })}</Chip>}
				{row.replacements.length > 0 && <Chip tone='provenance'>{t('updatePrices.replacedDays', { count: row.replacements.length })}</Chip>}
				{row.unchangedCount > 0 && <Chip tone='quiet'>{t('updatePrices.unchangedDays', { count: row.unchangedCount })}</Chip>}
				{row.droppedCount > 0 && <Chip tone='danger'>{t('updatePrices.droppedDays', { count: row.droppedCount })}</Chip>}
			</>
		);
	};

	// The days that would land on a different value, which are the only writes that take something away
	const replacementsOf = (row: PriceUpdateRow): ReactNode => {
		return (
			<dl className='update-prices-replacements'>
				<dt>{t('updatePrices.replacementsTitle', { count: row.replacements.length })}</dt>
				{row.replacements.map((replacement) => {
					return (
						<dd key={replacement.date}>
							{formatter.storedDate(replacement.date)}
							{' · '}
							<span className='investments-screen-quiet'>
								{t('updatePrices.replacementNow', {
									value: formatter.unitPrice(replacement.previous.value),
									source: t(`prices.sources.${replacement.previous.source}`)
								})}
							</span>
							{' → '}
							{formatter.unitPrice(replacement.value)}
						</dd>
					);
				})}
			</dl>
		);
	};

	const cameBackOf = (entry: PriceUpdateEntry): ReactNode => {
		if(entry.state === 'not-asked') {
			return <span className='investments-screen-quiet'>{t('updatePrices.notAsked')}</span>;
		}

		if(entry.state === 'queued') {
			return <span className='investments-screen-quiet'>{t('updatePrices.queued')}</span>;
		}

		if(entry.state === 'asking') {
			return <span className='update-prices-asking'>{t('updatePrices.asking')}</span>;
		}

		if(entry.state === 'problem') {
			return (
				<>
					<span className='investments-screen-negative'>{problemReason(entry.problem)}</span>
					{entry.retryable && <> <Chip tone='provenance'>{t('updatePrices.canRetry')}</Chip></>}
				</>
			);
		}

		return (
			<>
				{countsOf(entry.row)}
				{entry.row.replacements.length > 0 && (
					<button
						type='button'
						className='update-prices-expand'
						aria-expanded={expanded.has(entry.security.id)}
						onClick={() => {
							onExpand(entry.security.id);
						}}>
						{expanded.has(entry.security.id) ? t('updatePrices.hideReplacements') : t('updatePrices.showReplacements')}
					</button>
				)}
				{expanded.has(entry.security.id) && replacementsOf(entry.row)}
			</>
		);
	};

	const columns: readonly DataTableColumn<PriceUpdateEntry>[] = [
		{
			key: 'selection',
			header: (
				<input
					type='checkbox'
					className='data-table-checkbox'
					checked={writable.length > 0 && tickedRows.length === writable.length}
					disabled={running || writable.length === 0}
					aria-label={t('updatePrices.tickAll')}
					onChange={() => {
						onTickAll(tickedRows.length !== writable.length);
					}}/>
			),
			render: (entry) => {
				const writeable = isWritable(entry);

				return (
					<input
						type='checkbox'
						className='data-table-checkbox'
						checked={ticked.has(entry.security.id)}
						disabled={running || !writeable}
						aria-label={writeable ?
							t('updatePrices.write', { ticker: entry.security.ticker }) :
							t('updatePrices.cannotWrite', { ticker: entry.security.ticker })}
						onChange={() => {
							onToggle(entry.security.id);
						}}/>
				);
			}
		},
		{
			key: 'security',
			header: t('updatePrices.columns.security'),
			render: (entry) => {
				return (
					<>
						{entry.security.ticker} <span className='investments-screen-quiet'>{entry.security.name}</span>
					</>
				);
			}
		},
		{
			key: 'quote',
			header: t('updatePrices.columns.quote'),
			numeric: true,
			render: (entry) => {
				return entry.state === 'quoted' ? formatter.unitPrice(entry.row.value) : t('table.notApplicable');
			}
		},
		{
			key: 'quoteDate',
			header: t('updatePrices.columns.quoteDate'),
			numeric: true,
			render: (entry) => {
				return entry.state === 'quoted' ? formatter.storedDate(entry.row.date) : t('table.notApplicable');
			}
		},
		{
			key: 'cameBack',
			header: t('updatePrices.columns.cameBack'),
			render: cameBackOf
		}
	];

	const footer = (): ReactNode => {
		if(running) {
			return t('updatePrices.stillRunning');
		}

		if(summary.writeCount === 0) {
			return t('updatePrices.nothingToWrite');
		}

		return t('updatePrices.reviewFooter', {
			writes: t('updatePrices.writeCount', { count: summary.writeCount }),
			securities: t('updatePrices.securityCount', { count: summary.securityCount }),
			replaced: summary.replacedCount === 0 ?
				t('updatePrices.replacedNone') :
				t('updatePrices.replaced', {
					count: summary.replacedCount,
					manual: t('updatePrices.replacedManual', { count: summary.replacedManualCount })
				}),
			rest: t('updatePrices.unchangedAndDropped', {
				unchanged: t('updatePrices.unchangedCount', { count: summary.unchangedCount }),
				dropped: t('updatePrices.droppedCount', { count: summary.droppedCount })
			})
		});
	};

	return (
		<>
			{running && (
				<div className='update-prices-progress' role='status'>
					<div className='update-prices-bar'>
						<i style={{ width: `${total === 0 ? 0 : Math.round(done / total * 100)}%` }}/>
					</div>
					<span>
						{askingTicker === undefined ?
							t('updatePrices.progressAsked', { done: formatter.integer(done), total: formatter.integer(total) }) :
							t('updatePrices.progress', {
								done: formatter.integer(done),
								total: formatter.integer(total),
								ticker: askingTicker
							})}
					</span>
				</div>
			)}

			{!running && (
				<div className='update-prices-selectors'>
					<span className='update-prices-selectors-label'>{t('updatePrices.select')}</span>
					<AppButton
						disabled={writable.length === 0}
						onClick={() => {
							onTickAll(true);
						}}>
						{t('updatePrices.selectors.writable')}
					</AppButton>
					<AppButton
						disabled={tickedRows.length === 0}
						onClick={() => {
							onTickAll(false);
						}}>
						{t('updatePrices.selectors.none')}
					</AppButton>
					{referenceDate !== undefined && (
						<span className='update-prices-reference'>
							{t('updatePrices.referenceDate', { date: formatter.storedDate(referenceDate) })}
						</span>
					)}
				</div>
			)}

			<DataTable
				columns={columns}
				rows={entries}
				label={t('updatePrices.reviewTable')}
				footer={footer()}
				getRowClassName={(entry) => {
					return entry.state === 'problem' || entry.state === 'not-asked' || !isWritable(entry) ?
						'update-prices-row-quiet' :
						undefined;
				}}
				getRowKey={(entry) => {
					return entry.security.id;
				}}/>

			<div className='update-prices-actions'>
				<AppButton disabled={running} onClick={onBack}>{t('updatePrices.changeOptions')}</AppButton>
				{retryableCount > 0 && (
					<AppButton disabled={running} onClick={onRetry}>
						{t('updatePrices.retry', { count: retryableCount })}
					</AppButton>
				)}
				<div className='update-prices-actions-right'>
					<AppButton variant='ghost' onClick={onCancel}>
						{running || summary.writeCount > 0 ? t('dialog.cancel') : t('updatePrices.close')}
					</AppButton>
					<AppButton variant='primary' disabled={running || summary.writeCount === 0} onClick={onConfirm}>
						{t('updatePrices.confirm', { count: summary.writeCount })}
					</AppButton>
				</div>
			</div>
		</>
	);
};
