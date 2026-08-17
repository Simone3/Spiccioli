import type { ReactElement } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { TRANSACTIONS_CONFIG } from 'src/config/AppConfig';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * The pager of the one paginated table in the application.
 *
 * The screen opens on the last page and a filter change lands there too, so this is how the history is walked back rather than
 * how it is reached. It states where it is as well as offering the two steps, since a page number on its own says nothing about
 * how much is behind it.
 */

export interface TransactionsPagerProps {
	page: number;
	pageCount: number;
	onChange: (page: number) => void;
}

/**
 * The pager.
 * @param props The pager's props.
 * @param props.page The page in view, counting from one.
 * @param props.pageCount How many pages the filters make.
 * @param props.onChange What turning the page does.
 * @returns The pager.
 */
export const TransactionsPager = ({ page, pageCount, onChange }: TransactionsPagerProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	return (
		<div className='transactions-screen-pager' role='group' aria-label={t('transactions.pager.label')}>
			<AppButton
				variant='ghost'
				disabled={page <= 1}
				onClick={() => {
					onChange(page - 1);
				}}>
				{t('transactions.pager.previous')}
			</AppButton>
			<span className='transactions-screen-pager-position'>
				{t('transactions.pager.position', {
					page: formatter.integer(page),
					pages: formatter.integer(pageCount),
					rows: formatter.integer(TRANSACTIONS_CONFIG.rowsPerPage)
				})}
			</span>
			<AppButton
				variant='ghost'
				disabled={page >= pageCount}
				onClick={() => {
					onChange(page + 1);
				}}>
				{t('transactions.pager.next')}
			</AppButton>
		</div>
	);
};
