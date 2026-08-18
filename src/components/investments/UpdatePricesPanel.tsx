import { useEffect, useId, useRef, type ReactElement } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { PricePassSpan, PriceUpdateProblem, PriceUpdateReview, PriceUpdateRow } from 'src/logic/investments/PriceUpdate';

/**
 * What came back from a price pass, put to the user before a single record is written.
 *
 * **One confirmation covers the pass. There is nothing to tick and no row to exclude**: the choice this panel offers is this
 * pass or none of it, and a figure that turns out to be wrong afterwards is corrected in the price history like any other.
 *
 * **A pass with nothing to write still shows this panel** — every security having failed is a report worth reading — and offers
 * only *Close*.
 *
 * **A pass that asked for a span reads as the shorter one does, plus what a span adds.** Every row still leads with the newest
 * quote and the day it is for, because that is the figure a holding is valued at; the two columns beside it say how many days
 * came back with it and how many of those land on a value that is already there.
 *
 * **The statement of what left the machine is repeated here**, beside what a request brought back, because that is the moment the
 * question of what it took occurs to the reader.
 */

export interface UpdatePricesPanelProps {
	review: PriceUpdateReview;

	// How many securities were asked about, which is not the number of rows: the ones that failed were asked about too
	askedCount: number;

	// Which of the two passes this was. A span grows the table by the two columns that count days; the shorter pass has one day
	// per row and nothing to count, so it reads exactly as it always has.
	span: PricePassSpan;

	// Writes every row, each as a fetched Price dated the day its quote is for
	onConfirm: () => void;

	onCancel: () => void;
}

/**
 * The review panel.
 * @param props The panel's props.
 * @param props.review What came back, read against the file.
 * @param props.askedCount How many securities the pass asked about.
 * @param props.span Which of the two passes this was.
 * @param props.onConfirm What confirming writes.
 * @param props.onCancel What cancelling does, which is nothing at all.
 * @returns The panel.
 */
export const UpdatePricesPanel = ({ review, askedCount, span, onConfirm, onCancel }: UpdatePricesPanelProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const titleId = useId();
	const dismissRef = useRef<HTMLDivElement>(null);

	// The keyboard opens on the button that writes nothing, like every other panel that asks something of the user
	useEffect(() => {
		dismissRef.current?.querySelector('button')?.focus();
	}, []);

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

	// The two a span adds. The shorter pass writes one day per row and has nothing to count, so it does not carry them.
	const dayColumns: readonly DataTableColumn<PriceUpdateRow>[] = [
		{
			key: 'days',
			header: t('updatePrices.columns.days'),
			numeric: true,
			render: (row) => {
				return formatter.integer(row.days.length);
			}
		},
		{
			key: 'replaces',
			header: t('updatePrices.columns.replaces'),
			numeric: true,
			render: (row) => {
				return row.replacesCount === 0 ?
					<span className='investments-screen-quiet'>{formatter.integer(0)}</span> :
					formatter.integer(row.replacesCount);
			}
		}
	];

	const columns: readonly DataTableColumn<PriceUpdateRow>[] = [
		{
			key: 'security',
			header: t('updatePrices.columns.security'),
			render: (row) => {
				return (
					<>
						{row.security.ticker} <span className='investments-screen-quiet'>{row.security.name}</span>
					</>
				);
			}
		},
		{
			key: 'quote',
			header: t('updatePrices.columns.quote'),
			numeric: true,
			render: (row) => {
				return formatter.unitPrice(row.value);
			}
		},
		{
			key: 'quoteDate',
			header: t('updatePrices.columns.quoteDate'),
			numeric: true,
			render: (row) => {
				return formatter.storedDate(row.date);
			}
		},
		{
			key: 'holds',
			header: t('updatePrices.columns.holds'),
			render: (row) => {
				if(!row.replaces) {
					return <span className='investments-screen-quiet'>{t('updatePrices.newDay')}</span>;
				}

				return (
					<>
						{formatter.unitPrice(row.replaces.value)}{' '}
						<Chip tone={row.replaces.source === 'fetched' ? 'provenance' : 'quiet'}>
							{t(`prices.sources.${row.replaces.source}`)}
						</Chip>
					</>
				);
			}
		}
	];

	const replacedText = (): string => {
		if(review.replacedCount === 0) {
			return t('updatePrices.replacedNone');
		}

		const replaced = t('updatePrices.replaced', { count: review.replacedCount });

		return review.replacedManualCount === 0 ?
			replaced :
			t('updatePrices.replacedWithManual', { replaced, count: review.replacedManualCount });
	};

	// The shorter pass writes one record per row and says which day they are all for. A span writes thousands and says how many
	// days they cover and how many came back it will not write — the count being the only honest way to state a series.
	const footer = span === 'latest' ?
		t('updatePrices.footer', {
			written: t('updatePrices.writtenCount', { count: review.dayCount }),
			replaced: replacedText(),
			quoted: review.commonDate === undefined ?
				t('updatePrices.quotedOverSeveralDays') :
				t('updatePrices.quotedOnOneDay', { date: formatter.storedDate(review.commonDate) })
		}) :
		t('updatePrices.footer', {
			written: t('updatePrices.writtenCount', { count: review.dayCount }),
			replaced: replacedText(),
			quoted: review.droppedCount === 0 ?
				t('updatePrices.droppedNone') :
				t('updatePrices.dropped', { count: review.droppedCount })
		});

	const securities = span === 'latest' ?
		t('updatePrices.securityCount', { count: askedCount }) :
		t('updatePrices.securityCountForHistory', { count: askedCount });
	const subtitle = review.referenceDate === undefined ?
		t('updatePrices.subtitle', { securities }) :
		t('updatePrices.subtitleWithReference', { securities, date: formatter.storedDate(review.referenceDate) });

	return (
		<div
			className='update-prices-overlay'
			role='presentation'
			onKeyDown={(event) => {
				if(event.key === 'Escape') {
					onCancel();
				}
			}}>
			<div className='update-prices-panel' role='dialog' aria-modal='true' aria-labelledby={titleId}>
				<div className='update-prices-heading'>
					<h2 className='update-prices-title' id={titleId}>{t('updatePrices.title')}</h2>
					<span className='investments-screen-detail-subtitle'>{subtitle}</span>
				</div>

				{review.rows.length === 0 ?
					<p className='investments-screen-note'>{t('updatePrices.nothingToWrite')}</p> :
					<DataTable
						columns={span === 'latest' ? columns : [ ...columns, ...dayColumns ]}
						rows={review.rows}
						label={t('updatePrices.table')}
						footer={footer}
						getRowKey={(row) => {
							return row.security.id;
						}}/>}

				{review.problems.length > 0 && (
					<>
						<h3 className='investments-screen-subhead'>{t('updatePrices.problems')}</h3>
						<dl className='investments-screen-figures'>
							{review.problems.map((problem) => {
								return (
									<div className='investments-screen-figure' key={problem.security.id}>
										<dt>
											{problem.security.ticker} <span className='investments-screen-quiet'>{problem.security.name}</span>
										</dt>
										<dd className='investments-screen-negative'>{problemReason(problem)}</dd>
									</div>
								);
							})}
						</dl>
					</>
				)}

				<p className='investments-screen-note'>{t('updatePrices.whatLeaves', { provider: t('updatePrices.providerName') })}</p>

				<div className='update-prices-actions'>
					<div ref={dismissRef}>
						<AppButton variant='ghost' onClick={onCancel}>
							{review.rows.length === 0 ? t('updatePrices.close') : t('dialog.cancel')}
						</AppButton>
					</div>
					{review.rows.length > 0 && (
						<AppButton variant='primary' onClick={onConfirm}>
							{t('updatePrices.confirm', { count: review.dayCount })}
						</AppButton>
					)}
				</div>
			</div>
		</div>
	);
};
