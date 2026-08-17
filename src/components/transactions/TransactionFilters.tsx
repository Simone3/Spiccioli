import type { ReactElement } from 'react';
import { AccountPicker } from 'src/components/accounts/AccountPicker';
import { CategoryPicker } from 'src/components/categories/CategoryPicker';
import { DateField } from 'src/components/common/DateField';
import { FilterBar, FilterBarFilter } from 'src/components/common/FilterBar';
import { AmountField } from 'src/components/common/NumericFields';
import { SelectField, type SelectOption } from 'src/components/common/SelectField';
import { TextField } from 'src/components/common/TextField';
import { useTranslator } from 'src/i18n/TranslationContext';
import { isAnyTransactionFilterSet, type TransactionFilters } from 'src/logic/transactions/Transactions';
import { CATEGORY_SOURCES, RECEIPT_STATES, type CategorySource, type ReceiptState } from 'src/types/LedgerTypes';

/**
 * The seven filters, each taking one value or none, combined with AND.
 *
 * There is no multiple selection anywhere: an account filter selects one account or *All*, a category filter one category. That
 * is what lets one screen hand its filters to another and know they fit.
 *
 * **The period and the amount range are both two controls under one label**, and both ends of both are inclusive. Either end may
 * be left open, and both open is no filter at all.
 */

// What every picker reads while its filter is not set. It is a value here rather than an empty field: it means "do not filter".
const NOT_FILTERED = '';

export interface TransactionFiltersProps {
	filters: TransactionFilters;

	// Called with the whole set, because changing one filter is what moves the list to the last page of what it now matches
	onChange: (filters: TransactionFilters) => void;

	onClear: () => void;
}

/**
 * The filter bar of the Transactions screen.
 * @param props The bar's props.
 * @param props.filters The filters in force.
 * @param props.onChange What changing one does.
 * @param props.onClear What clearing them all does.
 * @returns The bar.
 */
export const TransactionFiltersBar = ({ filters, onChange, onClear }: TransactionFiltersProps): ReactElement => {
	const { t } = useTranslator();

	const setByOptions: readonly SelectOption<string>[] = [
		{ value: NOT_FILTERED, label: t('transactions.filters.setByAnything') },
		...CATEGORY_SOURCES.map((source) => {
			return { value: source, label: source === 'automatic' ? t('transactions.filters.setByRule') : t('transactions.filters.setByHand') };
		})
	];

	const receiptOptions: readonly SelectOption<string>[] = [
		{ value: NOT_FILTERED, label: t('transactions.filters.receiptAny') },
		...RECEIPT_STATES.map((state) => {
			return { value: state, label: t(`receiptStates.${state}`) };
		})
	];

	return (
		<FilterBar isFiltered={isAnyTransactionFilterSet(filters)} onClear={onClear}>
			<FilterBarFilter label={t('transactions.filters.account')}>
				<AccountPicker
					value={filters.accountId}
					clearable
					side='cash'
					label={t('transactions.filters.account')}
					placeholder={t('transactions.filters.accountAll')}
					onChange={(accountId) => {
						onChange({ ...filters, accountId });
					}}/>
			</FilterBarFilter>

			<FilterBarFilter label={t('transactions.filters.period')}>
				<div className='transactions-screen-filter-pair'>
					<DateField
						value={filters.fromDate}
						label={t('transactions.filters.from')}
						onChange={(fromDate) => {
							onChange({ ...filters, fromDate });
						}}/>
					<DateField
						value={filters.toDate}
						label={t('transactions.filters.to')}
						onChange={(toDate) => {
							onChange({ ...filters, toDate });
						}}/>
				</div>
			</FilterBarFilter>

			<FilterBarFilter label={t('transactions.filters.category')}>
				<CategoryPicker
					value={filters.category}
					mode='filter'
					label={t('transactions.filters.category')}
					onChange={(category) => {
						onChange({ ...filters, category: category === NOT_FILTERED ? undefined : category });
					}}/>
			</FilterBarFilter>

			<FilterBarFilter label={t('transactions.filters.setBy')}>
				<SelectField
					value={filters.categorySource ?? NOT_FILTERED}
					options={setByOptions}
					label={t('transactions.filters.setBy')}
					onChange={(source) => {
						onChange({ ...filters, categorySource: source === NOT_FILTERED ? undefined : source as CategorySource });
					}}/>
			</FilterBarFilter>

			<FilterBarFilter label={t('transactions.filters.amount')}>
				<div className='transactions-screen-filter-pair'>
					<AmountField
						value={filters.minimumAmount}
						label={t('transactions.filters.amountFrom')}
						allowNegative
						onChange={(minimumAmount) => {
							onChange({ ...filters, minimumAmount });
						}}/>
					<AmountField
						value={filters.maximumAmount}
						label={t('transactions.filters.amountTo')}
						allowNegative
						onChange={(maximumAmount) => {
							onChange({ ...filters, maximumAmount });
						}}/>
				</div>
			</FilterBarFilter>

			<FilterBarFilter label={t('transactions.filters.receipt')}>
				<SelectField
					value={filters.receiptState ?? NOT_FILTERED}
					options={receiptOptions}
					label={t('transactions.filters.receipt')}
					onChange={(state) => {
						onChange({ ...filters, receiptState: state === NOT_FILTERED ? undefined : state as ReceiptState });
					}}/>
			</FilterBarFilter>

			<FilterBarFilter label={t('transactions.filters.search')}>
				<TextField
					value={filters.search}
					label={t('transactions.filters.search')}
					placeholder={t('transactions.filters.searchPlaceholder')}
					onChange={(search) => {
						onChange({ ...filters, search });
					}}/>
			</FilterBarFilter>
		</FilterBar>
	);
};
