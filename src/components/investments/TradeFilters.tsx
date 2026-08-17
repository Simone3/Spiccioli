import type { ReactElement } from 'react';
import { AccountPicker } from 'src/components/accounts/AccountPicker';
import { DateField } from 'src/components/common/DateField';
import { FilterBar, FilterBarFilter } from 'src/components/common/FilterBar';
import { SecurityPicker } from 'src/components/investments/SecurityPicker';
import { useTranslator } from 'src/i18n/TranslationContext';
import { isAnyTradeFilterSet, type TradeFilters } from 'src/logic/investments/Trades';

/**
 * The three filters both trade tables carry, each taking one value or none.
 *
 * **The account list holds brokerage accounts only**, like every account list on this screen: a trade never sits in a cash one.
 * The period is the same *from* and *to* pair the transactions list uses, inclusive at both ends.
 */

export interface TradeFiltersBarProps {
	filters: TradeFilters;
	onChange: (filters: TradeFilters) => void;
	onClear: () => void;
}

/**
 * The filter bar of the Purchases and Sales tabs.
 * @param props The bar's props.
 * @param props.filters The filters in force.
 * @param props.onChange What changing one does.
 * @param props.onClear What clearing them all does.
 * @returns The bar.
 */
export const TradeFiltersBar = ({ filters, onChange, onClear }: TradeFiltersBarProps): ReactElement => {
	const { t } = useTranslator();

	return (
		<FilterBar isFiltered={isAnyTradeFilterSet(filters)} onClear={onClear}>
			<FilterBarFilter label={t('trades.filters.security')}>
				<SecurityPicker
					clearable
					value={filters.securityId}
					label={t('trades.filters.security')}
					placeholder={t('trades.filters.securityAll')}
					onChange={(securityId) => {
						onChange({ ...filters, securityId });
					}}/>
			</FilterBarFilter>

			<FilterBarFilter label={t('trades.filters.account')}>
				<AccountPicker
					clearable
					side='brokerage'
					value={filters.accountId}
					label={t('trades.filters.account')}
					placeholder={t('trades.filters.accountAll')}
					onChange={(accountId) => {
						onChange({ ...filters, accountId });
					}}/>
			</FilterBarFilter>

			<FilterBarFilter label={t('trades.filters.period')}>
				<div className='investments-screen-filter-pair'>
					<DateField
						value={filters.fromDate}
						label={t('trades.filters.from')}
						onChange={(fromDate) => {
							onChange({ ...filters, fromDate });
						}}/>
					<DateField
						value={filters.toDate}
						label={t('trades.filters.to')}
						onChange={(toDate) => {
							onChange({ ...filters, toDate });
						}}/>
				</div>
			</FilterBarFilter>
		</FilterBar>
	);
};
