import { useState, type ReactElement } from 'react';
import { AccountPicker } from 'src/components/accounts/AccountPicker';
import { FormDialog, FormField } from 'src/components/common/FormDialog';
import { AmountField, PriceField, QuantityField } from 'src/components/common/NumericFields';
import { TextField } from 'src/components/common/TextField';
import { DateField } from 'src/components/common/DateField';
import {
	emptySecurityValues,
	isSecurityComplete,
	SecurityFields,
	type SecurityFormValues
} from 'src/components/investments/SecurityFields';
import { SecurityPicker } from 'src/components/investments/SecurityPicker';
import { useLedger } from 'src/contexts/LedgerContext';
import { useFormatter, usePreferences } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { findSecurityByIsinOrTicker, isIsinTaken } from 'src/logic/investments/Securities';
import { tradeTotal } from 'src/logic/investments/Trades';
import type { IsoDate, LedgerId, Millionths, TenThousandths, Trade, TradeKind } from 'src/types/LedgerTypes';

/**
 * The form a trade is recorded on and corrected in, and the one place a security is created without going to the Securities tab
 * first.
 *
 * **Typing an ISIN or a ticker searches the securities already recorded**; if none matches, the form expands with the fields
 * needed to create one and it is saved together with the trade. The fields are the same either way and so is the record — there
 * is no such thing as a security that came in by one path rather than the other. **A trade being corrected picks from the
 * securities that exist instead**: creating one belongs to the trade that first needs it, and every row already has its own.
 *
 * **The total is computed and shown live as the figures are typed, and never entered.** On a sale it is net proceeds instead,
 * with a *Taxes* field that defaults to zero and is never pre-filled from the hypothetical rate: what goes there is what the
 * broker actually withheld.
 *
 * **The account picker lists brokerage accounts only and starts empty**, no picker in the application remembering what was
 * chosen last.
 */

// The smallest quantity and the smallest price a field admits, each in the minor units its own field is stored in
const SMALLEST_QUANTITY = 1;

const SMALLEST_PRICE = 1;

export interface TradeFormValues {
	date: IsoDate;
	accountId: LedgerId;

	// The security chosen, or undefined when one is being created with the trade
	securityId: LedgerId | undefined;

	// The security to write alongside the trade, where the form expanded
	newSecurity: SecurityFormValues | undefined;

	quantity: Millionths;
	unitPrice: TenThousandths;
	fees: number;
	taxes: number;
	notes: string;
}

export interface TradeFormProps {
	kind: TradeKind;

	// The trade being corrected, or undefined while one is being recorded
	trade: Trade | undefined;

	onSave: (values: TradeFormValues) => void;
	onCancel: () => void;
}

/**
 * The trade form.
 * @param props The form's props.
 * @param props.kind Which of the two tabs opened it.
 * @param props.trade The trade being corrected, where one is.
 * @param props.onSave What to do with the trade the form holds.
 * @param props.onCancel What abandoning it does.
 * @returns The form.
 */
export const TradeForm = ({ kind, trade, onSave, onCancel }: TradeFormProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const { document } = useLedger();
	const { preferences } = usePreferences();
	const isSale = kind === 'sale';

	const [ date, setDate ] = useState<IsoDate | undefined>(() => {
		return trade?.date ?? DateUtils.toStandardYearMonthDay(DateUtils.startOfToday());
	});
	const [ accountId, setAccountId ] = useState<LedgerId | undefined>(trade?.accountId);
	const [ securityId, setSecurityId ] = useState<LedgerId | undefined>(trade?.securityId);
	const [ securityText, setSecurityText ] = useState('');
	const [ newSecurity, setNewSecurity ] = useState<SecurityFormValues>(() => {
		return emptySecurityValues(preferences.defaultTaxRate);
	});
	const [ quantity, setQuantity ] = useState<Millionths | undefined>(trade?.quantity);
	const [ unitPrice, setUnitPrice ] = useState<TenThousandths | undefined>(trade?.unitPrice);
	const [ fees, setFees ] = useState<number | undefined>(trade?.fees ?? 0);
	const [ taxes, setTaxes ] = useState<number | undefined>(trade?.taxes ?? 0);
	const [ notes, setNotes ] = useState(trade?.notes ?? '');

	const isCorrecting = trade !== undefined;
	const securities = document?.securities ?? [];
	const chosen = isCorrecting ?
		securities.find((security) => {
			return security.id === securityId;
		}) :
		undefined;
	const matched = isCorrecting ? chosen : findSecurityByIsinOrTicker(securities, securityText);
	const isSearching = securityText.trim() !== '';
	const isCreating = !isCorrecting && isSearching && !matched;

	// The expanded form opens on what was typed, and holds its own value the moment the ISIN field itself is used
	const newValues: SecurityFormValues = { ...newSecurity, isin: newSecurity.isin || securityText.trim() };
	const isIsinAlreadyRecorded = newValues.isin !== '' && isIsinTaken({ securities, isin: newValues.isin });

	const total = quantity !== undefined && unitPrice !== undefined ?
		tradeTotal({ kind, quantity, unitPrice, fees: fees ?? 0, taxes: isSale ? taxes ?? 0 : 0 }) :
		undefined;

	const canSave = date !== undefined &&
		accountId !== undefined &&
		(matched !== undefined || (isCreating && isSecurityComplete(newValues) && !isIsinAlreadyRecorded)) &&
		quantity !== undefined &&
		quantity > 0 &&
		unitPrice !== undefined &&
		fees !== undefined &&
		(!isSale || taxes !== undefined);

	const save = (): void => {
		if(!canSave || date === undefined || accountId === undefined || quantity === undefined || unitPrice === undefined) {
			return;
		}

		onSave({
			date,
			accountId,
			securityId: matched?.id,
			newSecurity: matched ? undefined : newValues,
			quantity,
			unitPrice,
			fees: fees ?? 0,
			taxes: isSale ? taxes ?? 0 : 0,
			notes: notes.trim()
		});
	};

	const tradeFormTitle = (): string => {
		if(isCorrecting) {
			return isSale ? t('trades.form.editSaleTitle') : t('trades.form.editPurchaseTitle');
		}

		return isSale ? t('trades.form.addSaleTitle') : t('trades.form.addPurchaseTitle');
	};

	const securityHint = (): string | undefined => {
		if(matched) {
			return t('securities.option', { ticker: matched.ticker, name: matched.name });
		}

		return isCreating ? t('trades.form.securityNotFound', { text: securityText.trim() }) : t('trades.form.securitySearchHint');
	};

	return (
		<FormDialog
			title={tradeFormTitle()}
			subtitle={isSale ? t('trades.form.saleSubtitle') : t('trades.form.purchaseSubtitle')}
			canSave={canSave}
			onSave={save}
			onCancel={onCancel}>
			<FormField label={t('trades.form.date')}>
				<DateField value={date} label={t('trades.form.date')} required onChange={setDate}/>
			</FormField>

			<FormField label={t('trades.form.account')}>
				<AccountPicker
					side='brokerage'
					value={accountId}
					label={t('trades.form.account')}
					placeholder={t('trades.form.accountChoose')}
					onChange={setAccountId}/>
			</FormField>

			<FormField label={t('trades.form.security')} hint={isCorrecting ? undefined : securityHint()}>
				{isCorrecting ?
					<SecurityPicker
						value={securityId}
						label={t('trades.form.security')}
						placeholder={t('trades.form.securityChoose')}
						onChange={setSecurityId}/> :
					<TextField
						value={securityText}
						label={t('trades.form.security')}
						placeholder={t('trades.form.securitySearch')}
						onChange={setSecurityText}/>}
			</FormField>

			{isCreating && (
				<>
					<FormField label={t('trades.form.newSecurity')}>
						<p className='investments-screen-note'>{t('trades.form.securitySearchHint')}</p>
					</FormField>
					<SecurityFields
						values={newValues}
						isinRefusal={isIsinAlreadyRecorded ? t('securities.form.isinTaken') : undefined}
						onChange={setNewSecurity}/>
				</>
			)}

			<FormField label={t('trades.form.quantity')}>
				<QuantityField
					value={quantity}
					label={t('trades.form.quantity')}
					required
					minimum={SMALLEST_QUANTITY}
					onChange={setQuantity}/>
			</FormField>

			<FormField label={t('trades.form.unitPrice')}>
				<PriceField
					value={unitPrice}
					label={t('trades.form.unitPrice')}
					required
					minimum={SMALLEST_PRICE}
					onChange={setUnitPrice}/>
			</FormField>

			<FormField label={t('trades.form.fees')}>
				<AmountField value={fees} label={t('trades.form.fees')} required minimum={0} onChange={setFees}/>
			</FormField>

			{isSale && (
				<FormField label={t('trades.form.taxes')} hint={t('trades.form.taxesHint')}>
					<AmountField value={taxes} label={t('trades.form.taxes')} required minimum={0} onChange={setTaxes}/>
				</FormField>
			)}

			<FormField label={t('trades.form.notes')}>
				<TextField value={notes} label={t('trades.form.notes')} placeholder={t('form.optional')} onChange={setNotes}/>
			</FormField>

			<FormField label={isSale ? t('trades.form.netProceeds') : t('trades.form.totalCost')} hint={t('trades.form.derived')}>
				<p className='investments-screen-derived'>
					{total === undefined ? t('table.notApplicable') : formatter.amount(total)}
				</p>
			</FormField>
		</FormDialog>
	);
};
