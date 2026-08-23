import type { ReactElement, ReactNode } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { useFormatter, usePreferences } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { formatAccountName } from 'src/logic/accounts/Accounts';
import type { Holding } from 'src/logic/investments/Holdings';
import { isPriceStale } from 'src/logic/investments/Securities';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import type { Account, Institution, LedgerId, Security, TenThousandths } from 'src/types/LedgerTypes';

/**
 * What one holding is made of, and what selling it today would produce.
 *
 * The panel is in two halves and the order is the point. **The upper half is what has happened** — what is held, the lots it
 * came from, what was sold, the weighted average, what was invested including fees, the purchase fees inside that figure, the
 * price the position is valued at with the day it is as of, and the annualised return, which belongs here rather than below
 * because it is a statement about the position's history and not about liquidating it.
 *
 * **The purchase-fee line is labelled by what it means on the position in front of the reader.** The fees are amortised into the
 * average cost across the quantity purchased, so a sale carries off its share of them: on a position nothing has been sold out of
 * the whole figure is still inside *Invested*, and it reads *of which*; on one partly sold only part of it is, and it reads as
 * what was paid instead. It is stated at all because the gain above is measured on a cost that includes it, which is where a
 * broker's own figure for the same position differs. **The lower half is an estimate**, and the caveat sits with it: average cost
 * is an approximation and a broker may match lots differently, the tax is worked out for this position alone so a loss on
 * another holding does not reduce it, and the sell fee is charged once per holding. The last two both push the figure down,
 * which is the part worth knowing about an estimate.
 *
 * **The price and its date are here rather than on a row** because a price belongs to the security and not to the holding: the
 * same instrument held at two institutions is two rows and one price, and the Securities tab is where it is kept. **A date
 * older than the staleness threshold is marked in the date itself** — the date is the thing that has gone wrong, so the date is
 * what is marked, and the panel says *how* stale rather than only *that* it is. **A security with no price at all is marked
 * differently rather than more loudly**: the price reads *none* and the date an em dash, which is not marked, there being no
 * date to age.
 */

export interface HoldingDetailPanelProps {
	holding: Holding;
	security: Security | undefined;
	account: Account | undefined;
	institutions: ReadonlyMap<LedgerId, Institution>;

	// The annualised return of this position, or undefined where there is none to state
	annualisedReturn: TenThousandths | undefined;

	onClose: () => void;
}

/**
 * One figure of the panel: what it is, and what it reads.
 * @param props The figure's props.
 * @param props.label What the figure is.
 * @param props.children What it reads.
 * @returns The figure.
 */
const DetailFigure = ({ label, children }: { label: string; children: ReactNode }): ReactElement => {
	return (
		<div className='investments-screen-figure'>
			<dt>{label}</dt>
			<dd>{children}</dd>
		</div>
	);
};

/**
 * The holding detail panel.
 * @param props The panel's props.
 * @param props.holding The holding.
 * @param props.security Its security.
 * @param props.account The brokerage account it sits in.
 * @param props.institutions The institutions, by id.
 * @param props.annualisedReturn What the money in this position has earned per year.
 * @param props.onClose What closing the panel does.
 * @returns The panel.
 */
export const HoldingDetailPanel = ({
	holding,
	security,
	account,
	institutions,
	annualisedReturn,
	onClose
}: HoldingDetailPanelProps): ReactElement => {
	const translator = useTranslator();
	const { t } = translator;
	const formatter = useFormatter();
	const { preferences } = usePreferences();

	const amount = (working: number, explicitSign = false): string => {
		return formatter.amount(narrowFromWorkingScale(working, MONEY_SCALES.amount), explicitSign);
	};

	const signed = (working: number): ReactElement => {
		const cents = narrowFromWorkingScale(working, MONEY_SCALES.amount);

		return <span className={cents < 0 ? 'investments-screen-negative' : 'investments-screen-positive'}>{formatter.amount(cents, true)}</span>;
	};

	const lastPriced = (): ReactNode => {
		if(holding.priceDate === undefined) {
			return <span className='investments-screen-quiet'>{t('table.notApplicable')}</span>;
		}

		const stale = isPriceStale(holding.priceDate, preferences.priceStalenessDays);

		return (
			<span className={stale ? 'investments-screen-stale' : undefined}>{formatter.storedDate(holding.priceDate)}</span>
		);
	};

	const institution = account?.institutionId === null || account?.institutionId === undefined ?
		undefined :
		institutions.get(account.institutionId);

	// The fees are amortised into the average, so only a position nothing has been sold out of still holds all of them
	const purchaseFeesLabel = holding.soldQuantity === 0 ?
		t('holdings.detail.purchaseFees') :
		t('holdings.detail.purchaseFeesPartlySold');

	const netGainFigure = holding.netGainPct === undefined ?
		amount(holding.netGain, true) :
		t('holdings.gainWithPercentage', { gain: amount(holding.netGain, true), percentage: formatter.percentage(holding.netGainPct) });

	return (
		<aside className='investments-screen-detail' aria-label={t('holdings.table')}>
			<div className='investments-screen-detail-head'>
				<div>
					<b>{security?.ticker ?? ''}</b>
					<span className='investments-screen-detail-subtitle'>
						{[
							security?.isin,
							security?.name,
							security ? t(`securityTypes.${security.type}`) : undefined,
							account ? formatAccountName(account, institutions, translator) : undefined
						].filter(Boolean).join(' · ')}
					</span>
				</div>
				<AppButton variant='ghost' onClick={onClose}>{t('dialog.cancel')}</AppButton>
			</div>

			<dl className='investments-screen-figures'>
				<DetailFigure label={t('holdings.detail.held')}>{formatter.quantity(holding.quantity)}</DetailFigure>
				<DetailFigure label={t('holdings.detail.purchasedLots', { count: holding.lotCount })}>
					{formatter.quantity(holding.purchasedQuantity)}
				</DetailFigure>
				<DetailFigure label={t('holdings.detail.sold')}>{formatter.quantity(holding.soldQuantity)}</DetailFigure>
				<DetailFigure label={t('holdings.detail.avgCost')}>
					{formatter.unitPrice(narrowFromWorkingScale(holding.avgCost, MONEY_SCALES.rate))}
				</DetailFigure>
				<DetailFigure label={t('holdings.detail.invested')}>{amount(holding.invested)}</DetailFigure>
				<DetailFigure label={purchaseFeesLabel}>{amount(holding.purchaseFees)}</DetailFigure>
				<DetailFigure label={t('holdings.detail.latestPrice')}>
					{holding.price === undefined ?
						<span className='investments-screen-nothing'>{t('holdings.noPrice')}</span> :
						formatter.unitPrice(holding.price)}
				</DetailFigure>
				<DetailFigure label={t('holdings.detail.lastPriced')}>{lastPriced()}</DetailFigure>
				<DetailFigure label={t('holdings.detail.annualisedReturn')}>
					{annualisedReturn === undefined ?
						<span className='investments-screen-quiet'>{t('table.undefined')}</span> :
						<span className={annualisedReturn < 0 ? 'investments-screen-negative' : 'investments-screen-positive'}>
							{formatter.percentage(annualisedReturn)}
						</span>}
				</DetailFigure>
			</dl>

			<p className='investments-screen-note'>{t('holdings.detail.returnExplanation')}</p>

			<h3 className='investments-screen-subhead'>{t('holdings.detail.ifSoldToday')}</h3>

			<dl className='investments-screen-figures'>
				<DetailFigure label={t('holdings.detail.grossProceeds')}>{amount(holding.marketValue)}</DetailFigure>
				<DetailFigure label={t('holdings.detail.sellFee', { institution: institution?.name ?? '' })}>
					{signed(-holding.sellFee)}
				</DetailFigure>
				<DetailFigure label={t('holdings.detail.taxableGain')}>{signed(holding.taxableGain)}</DetailFigure>
				<DetailFigure
					label={t('holdings.detail.tax', {
						rate: security ? formatter.percentage(security.taxRate) : '',
						security: security?.ticker ?? ''
					})}>
					{signed(-holding.tax)}
				</DetailFigure>
				<DetailFigure label={t('holdings.detail.netProceeds')}>{amount(holding.netProceeds)}</DetailFigure>
				<DetailFigure label={t('holdings.detail.netGain')}>
					<span className={holding.netGain < 0 ? 'investments-screen-negative' : 'investments-screen-positive'}>
						{netGainFigure}
					</span>
				</DetailFigure>
			</dl>

			<p className='investments-screen-note'>{t('holdings.detail.caveat')}</p>
		</aside>
	);
};
