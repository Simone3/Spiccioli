import type { ReactElement, ReactNode } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { formatAccountName } from 'src/logic/accounts/Accounts';
import type { Holding } from 'src/logic/investments/Holdings';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import type { Account, Institution, LedgerId, Security, TenThousandths } from 'src/types/LedgerTypes';

/**
 * What one holding is made of, and what selling it today would produce.
 *
 * The panel is in two halves and the order is the point. **The upper half is what has happened** — the quantity and the lots it
 * came from, what was sold, the weighted average, what was invested including fees, and the annualised return, which belongs
 * here rather than below because it is a statement about the position's history and not about liquidating it. **The lower half
 * is an estimate**, and the caveat sits with it: average cost is an approximation and a broker may match lots differently, the
 * tax is worked out for this position alone so a loss on another holding does not reduce it, and the sell fee is charged once
 * per holding. The last two both push the figure down, which is the part worth knowing about an estimate.
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

	const amount = (working: number, explicitSign = false): string => {
		return formatter.amount(narrowFromWorkingScale(working, MONEY_SCALES.amount), explicitSign);
	};

	const signed = (working: number): ReactElement => {
		const cents = narrowFromWorkingScale(working, MONEY_SCALES.amount);

		return <span className={cents < 0 ? 'investments-screen-negative' : 'investments-screen-positive'}>{formatter.amount(cents, true)}</span>;
	};

	const institution = account?.institutionId === null || account?.institutionId === undefined ?
		undefined :
		institutions.get(account.institutionId);

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
				<DetailFigure label={t('holdings.detail.purchasedLots', { count: holding.lotCount })}>
					{formatter.quantity(holding.purchasedQuantity)}
				</DetailFigure>
				<DetailFigure label={t('holdings.detail.sold')}>{formatter.quantity(holding.soldQuantity)}</DetailFigure>
				<DetailFigure label={t('holdings.detail.avgCost')}>
					{formatter.unitPrice(narrowFromWorkingScale(holding.avgCost, MONEY_SCALES.rate))}
				</DetailFigure>
				<DetailFigure label={t('holdings.detail.invested')}>{amount(holding.invested)}</DetailFigure>
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
