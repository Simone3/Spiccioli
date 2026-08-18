import { useEffect, useId, useRef, type ReactElement } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { PriceUpdateProblem, PriceUpdateReview, PriceUpdateRow } from 'src/logic/investments/PriceUpdate';

/**
 * What came back from a price pass, put to the user before a single record is written.
 *
 * **One confirmation covers the pass. There is nothing to tick and no row to exclude**: the choice this panel offers is this
 * pass or none of it, and a figure that turns out to be wrong afterwards is corrected in the price history like any other.
 *
 * **A pass with nothing to write still shows this panel** — every security having failed is a report worth reading — and offers
 * only *Close*.
 *
 * **The statement of what left the machine is repeated here**, beside what a request brought back, because that is the moment the
 * question of what it took occurs to the reader.
 */

export interface UpdatePricesPanelProps {
	review: PriceUpdateReview;

	// How many securities were asked about, which is not the number of rows: the ones that failed were asked about too
	askedCount: number;

	// Writes every row, each as a fetched Price dated the day its quote is for
	onConfirm: () => void;

	onCancel: () => void;
}

/**
 * The review panel.
 * @param props The panel's props.
 * @param props.review What came back, read against the file.
 * @param props.askedCount How many securities the pass asked about.
 * @param props.onConfirm What confirming writes.
 * @param props.onCancel What cancelling does, which is nothing at all.
 * @returns The panel.
 */
export const UpdatePricesPanel = ({ review, askedCount, onConfirm, onCancel }: UpdatePricesPanelProps): ReactElement => {
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

	const footer = t('updatePrices.footer', {
		written: t('updatePrices.writtenCount', { count: review.rows.length }),
		replaced: replacedText(),
		quoted: review.commonDate === undefined ?
			t('updatePrices.quotedOverSeveralDays') :
			t('updatePrices.quotedOnOneDay', { date: formatter.storedDate(review.commonDate) })
	});

	const subtitle = review.referenceDate === undefined ?
		t('updatePrices.subtitle', { securities: t('updatePrices.securityCount', { count: askedCount }) }) :
		t('updatePrices.subtitleWithReference', {
			securities: t('updatePrices.securityCount', { count: askedCount }),
			date: formatter.storedDate(review.referenceDate)
		});

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
						columns={columns}
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
							{t('updatePrices.confirm', { count: review.rows.length })}
						</AppButton>
					)}
				</div>
			</div>
		</div>
	);
};
