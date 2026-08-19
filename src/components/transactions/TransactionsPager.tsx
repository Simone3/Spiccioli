import { useEffect, useState, type ReactElement } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * The pager of the one paginated table in the application.
 *
 * The screen opens on the first page and a filter change lands there too, the list being shown newest first, so this is how the
 * history is walked back. **The two ends are one step away from anywhere**: first and last beside previous and next, and a page
 * reached by neither is typed into the box between them. It states how many pages there are as well, a page number on its own
 * saying nothing about how much is behind it.
 */

// The typing is ours, as it is in the date field: a character that is not a digit never lands in the box
const DIGITS_ONLY = /^\d*$/u;

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

	// What is in the box, which is the page in view until the user types something else into it
	const [ typed, setTyped ] = useState(String(page));

	useEffect(() => {
		setTyped(String(page));
	}, [ page ]);

	// A page outside the list is refused rather than clamped, and the box goes back to the page actually in view
	const commit = (): void => {
		const requested = Number(typed);

		if(typed === '' || !Number.isInteger(requested) || requested < 1 || requested > pageCount) {
			setTyped(String(page));

			return;
		}

		onChange(requested);
	};

	return (
		<div className='transactions-screen-pager' role='group' aria-label={t('transactions.pager.label')}>
			<AppButton
				variant='ghost'
				disabled={page <= 1}
				label={t('transactions.pager.firstLabel')}
				onClick={() => {
					onChange(1);
				}}>
				{t('transactions.pager.first')}
			</AppButton>
			<AppButton
				variant='ghost'
				disabled={page <= 1}
				label={t('transactions.pager.previousLabel')}
				onClick={() => {
					onChange(page - 1);
				}}>
				{t('transactions.pager.previous')}
			</AppButton>
			<span className='transactions-screen-pager-position'>
				{t('transactions.pager.page')}
				<input
					type='text'
					inputMode='numeric'
					autoComplete='off'
					className='transactions-screen-pager-page'
					value={typed}
					aria-label={t('transactions.pager.goTo')}
					onChange={(event) => {
						if(DIGITS_ONLY.test(event.target.value)) {
							setTyped(event.target.value);
						}
					}}
					onBlur={commit}
					onKeyDown={(event) => {
						if(event.key === 'Enter') {
							commit();
						}
						else if(event.key === 'Escape') {
							setTyped(String(page));
						}
					}}/>
				{t('transactions.pager.of', { pages: formatter.integer(pageCount) })}
			</span>
			<AppButton
				variant='ghost'
				disabled={page >= pageCount}
				label={t('transactions.pager.nextLabel')}
				onClick={() => {
					onChange(page + 1);
				}}>
				{t('transactions.pager.next')}
			</AppButton>
			<AppButton
				variant='ghost'
				disabled={page >= pageCount}
				label={t('transactions.pager.lastLabel')}
				onClick={() => {
					onChange(pageCount);
				}}>
				{t('transactions.pager.last')}
			</AppButton>
		</div>
	);
};
