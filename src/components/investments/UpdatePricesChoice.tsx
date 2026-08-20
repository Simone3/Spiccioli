import { useId, type ReactElement } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { PRICE_PASS_SPANS, type PriceListingPlan, type PricePassSpan, type PriceSelectionKind } from 'src/logic/investments/PriceUpdate';
import type { LedgerId } from 'src/types/LedgerTypes';

/**
 * The first page of the modal: which securities to ask about, and how far back.
 *
 * **Everything that will leave the machine is on this page before any of it does.** The row states the listing, and the *Ask
 * from* column states the one other thing a request carries — the first day of its window — security by security. Changing the
 * span rewrites that column, so what an answer costs is read rather than described.
 *
 * **Every security in the file is listed, held or fully sold**, and the held ones open ticked: a closed position has a history
 * worth completing and is one tick away, but it is not what a weekly press of the button is for.
 */

const SELECTORS: readonly PriceSelectionKind[] = [ 'all', 'none', 'held', 'never-priced', 'stale' ];

const SELECTOR_LABELS = {
	all: 'updatePrices.selectors.all',
	none: 'updatePrices.selectors.none',
	held: 'updatePrices.selectors.held',
	'never-priced': 'updatePrices.selectors.neverPriced',
	stale: 'updatePrices.selectors.stale'
} as const satisfies Record<PriceSelectionKind, string>;

const SPAN_LABELS = {
	latest: { name: 'updatePrices.spans.latest', note: 'updatePrices.spans.latestNote' },
	'since-last': { name: 'updatePrices.spans.sinceLast', note: 'updatePrices.spans.sinceLastNote' },
	'whole-history': { name: 'updatePrices.spans.wholeHistory', note: 'updatePrices.spans.wholeHistoryNote' }
} as const satisfies Record<PricePassSpan, { name: string; note: string }>;

export interface UpdatePricesChoiceProps {
	plans: readonly PriceListingPlan[];
	span: PricePassSpan;
	onSpanChange: (span: PricePassSpan) => void;

	selected: ReadonlySet<LedgerId>;
	onToggle: (securityId: LedgerId) => void;

	// Sets the whole selection, rather than adding to it
	onSelect: (kind: PriceSelectionKind) => void;

	onCancel: () => void;

	// The one control on the page that reaches the network
	onFetch: () => void;
}

/**
 * The choosing page.
 * @param props The page's props.
 * @param props.plans Every security in the file, with what the pass would ask about it.
 * @param props.span Which of the three spans is chosen.
 * @param props.onSpanChange What choosing another span does.
 * @param props.selected Which securities are ticked.
 * @param props.onToggle What ticking one does.
 * @param props.onSelect What a selector does.
 * @param props.onCancel What closing without asking anything does.
 * @param props.onFetch What starting the pass does.
 * @returns The page.
 */
export const UpdatePricesChoice = ({
	plans,
	span,
	onSpanChange,
	selected,
	onToggle,
	onSelect,
	onCancel,
	onFetch
}: UpdatePricesChoiceProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const spanId = useId();

	const chosen = plans.filter((plan) => {
		return selected.has(plan.security.id);
	});
	const dayCount = chosen.reduce((total, plan) => {
		return total + plan.dayCount;
	}, 0);
	const securityCount = t('updatePrices.securityCount', { count: chosen.length });

	const columns: readonly DataTableColumn<PriceListingPlan>[] = [
		{
			key: 'selection',
			header: (
				<input
					type='checkbox'
					className='data-table-checkbox'
					checked={chosen.length === plans.length && plans.length > 0}
					aria-label={t('updatePrices.selectAll')}
					onChange={() => {
						onSelect(chosen.length === plans.length ? 'none' : 'all');
					}}/>
			),
			render: (plan) => {
				return (
					<input
						type='checkbox'
						className='data-table-checkbox'
						checked={selected.has(plan.security.id)}
						aria-label={t('updatePrices.askAbout', { ticker: plan.security.ticker })}
						onChange={() => {
							onToggle(plan.security.id);
						}}/>
				);
			}
		},
		{
			key: 'security',
			header: t('updatePrices.columns.security'),
			render: (plan) => {
				return (
					<>
						{plan.security.ticker} <span className='investments-screen-quiet'>{plan.security.name}</span>
						{!plan.isHeld && <> <Chip tone='quiet'>{t('updatePrices.notHeld')}</Chip></>}
					</>
				);
			}
		},
		{
			key: 'type',
			header: t('securities.columns.type'),
			render: (plan) => {
				return <Chip tone='quiet'>{t(`securityTypes.${plan.security.type}`)}</Chip>;
			}
		},
		{
			key: 'lastPrice',
			header: t('updatePrices.columns.lastPrice'),
			numeric: true,
			render: (plan) => {
				return plan.lastPrice === undefined ?
					<span className='update-prices-unpriced'>{t('updatePrices.neverPriced')}</span> :
					formatter.unitPrice(plan.lastPrice.value);
			}
		},
		{
			key: 'pricedOn',
			header: t('updatePrices.columns.pricedOn'),
			numeric: true,
			render: (plan) => {
				return plan.lastPrice === undefined ?
					t('table.notApplicable') :
					formatter.storedDate(plan.lastPrice.date);
			}
		},
		{
			key: 'askFrom',
			header: t('updatePrices.columns.askFrom'),
			numeric: true,
			render: (plan) => {
				return plan.from === null ?
					<span className='investments-screen-quiet'>{t('updatePrices.latestOnly')}</span> :
					formatter.storedDate(plan.from);
			}
		},
		{
			key: 'days',
			header: t('updatePrices.columns.days'),
			numeric: true,
			render: (plan) => {
				return plan.dayCount === 0 ? t('table.notApplicable') : formatter.integer(plan.dayCount);
			}
		}
	];

	return (
		<>
			<fieldset className='update-prices-spans'>
				<legend>{t('updatePrices.spanLegend')}</legend>
				{PRICE_PASS_SPANS.map((candidate) => {
					return (
						<label className={`update-prices-span${span === candidate ? ' update-prices-span-chosen' : ''}`} key={candidate}>
							<span className='update-prices-span-name'>
								<input
									type='radio'
									name={`${spanId}-span`}
									className='update-prices-span-radio'
									checked={span === candidate}
									aria-label={t(SPAN_LABELS[candidate].name)}
									aria-describedby={`${spanId}-${candidate}`}
									onChange={() => {
										onSpanChange(candidate);
									}}/>
								{t(SPAN_LABELS[candidate].name)}
							</span>
							<span className='update-prices-span-note' id={`${spanId}-${candidate}`}>
								{t(SPAN_LABELS[candidate].note)}
							</span>
						</label>
					);
				})}
			</fieldset>

			<div className='update-prices-selectors'>
				<span className='update-prices-selectors-label'>{t('updatePrices.select')}</span>
				{SELECTORS.map((kind) => {
					return (
						<AppButton
							key={kind}
							onClick={() => {
								onSelect(kind);
							}}>
							{t(SELECTOR_LABELS[kind])}
						</AppButton>
					);
				})}
			</div>

			<DataTable
				columns={columns}
				rows={plans}
				label={t('updatePrices.chooseTable')}
				footer={dayCount === 0 ?
					securityCount :
					t('updatePrices.chooseFooter', { securities: securityCount, days: t('updatePrices.dayCount', { count: dayCount }) })}
				getRowClassName={(plan) => {
					return selected.has(plan.security.id) ? undefined : 'update-prices-row-quiet';
				}}
				getRowKey={(plan) => {
					return plan.security.id;
				}}/>

			<p className='update-prices-note'>{t('updatePrices.whatLeaves', { provider: t('updatePrices.providerName') })}</p>

			<div className='update-prices-actions'>
				<AppButton variant='ghost' onClick={onCancel}>{t('dialog.cancel')}</AppButton>
				<div className='update-prices-actions-right'>
					<AppButton variant='primary' disabled={chosen.length === 0} onClick={onFetch}>
						{dayCount === 0 ?
							t('updatePrices.fetch', { securities: securityCount }) :
							t('updatePrices.fetchDays', { securities: securityCount, days: t('updatePrices.dayCount', { count: dayCount }) })}
					</AppButton>
				</div>
			</div>
		</>
	);
};
