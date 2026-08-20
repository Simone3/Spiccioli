import 'src/components/common/Pager.css';
import { useEffect, useState, type ReactElement } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * The pager of a paginated table, and the same five controls wherever one is: the transactions list and a security's price
 * history.
 *
 * A paged list opens on its first page and a change to what it holds lands there too, both lists being shown newest first, so
 * this is how a history is walked back. **The two ends are one step away from anywhere**: first and last beside previous and
 * next, and a page reached by neither is typed into the box between them. It states how many pages there are as well, a page
 * number on its own saying nothing about how much is behind it.
 *
 * **The four steps are glyphs and the box carries no label of its own**, because the narrower of the two tables it sits under is
 * a panel beside the securities and four words would not fit it. Nothing is lost to the keyboard or to a reading: every step is
 * a real button carrying its name, and the box says what it is for.
 *
 * **How long a page is belongs to the table and is never repeated here**: this control knows only which page is in view and how
 * many there are.
 */

// The typing is ours, as it is in the date field: a character that is not a digit never lands in the box
const DIGITS_ONLY = /^\d*$/u;

// What the four steps are drawn as. They are glyphs rather than words — a pager sits under a table and beside a panel, and four
// words of it do not fit a panel — so each one is hidden from the reading and the button carries the name instead.
const STEP_GLYPHS = {
	first: '«',
	previous: '‹',
	next: '›',
	last: '»'
} as const;

export interface PagerProps {
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
export const Pager = ({ page, pageCount, onChange }: PagerProps): ReactElement => {
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
		<div className='pager' role='group' aria-label={t('pager.label')}>
			<AppButton
				variant='ghost'
				disabled={page <= 1}
				label={t('pager.first')}
				onClick={() => {
					onChange(1);
				}}>
				<span aria-hidden='true'>{STEP_GLYPHS.first}</span>
			</AppButton>
			<AppButton
				variant='ghost'
				disabled={page <= 1}
				label={t('pager.previous')}
				onClick={() => {
					onChange(page - 1);
				}}>
				<span aria-hidden='true'>{STEP_GLYPHS.previous}</span>
			</AppButton>
			<span className='pager-position'>
				<input
					type='text'
					inputMode='numeric'
					autoComplete='off'
					className='pager-page'
					value={typed}
					aria-label={t('pager.goTo')}
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
				{t('pager.of', { pages: formatter.integer(pageCount) })}
			</span>
			<AppButton
				variant='ghost'
				disabled={page >= pageCount}
				label={t('pager.next')}
				onClick={() => {
					onChange(page + 1);
				}}>
				<span aria-hidden='true'>{STEP_GLYPHS.next}</span>
			</AppButton>
			<AppButton
				variant='ghost'
				disabled={page >= pageCount}
				label={t('pager.last')}
				onClick={() => {
					onChange(pageCount);
				}}>
				<span aria-hidden='true'>{STEP_GLYPHS.last}</span>
			</AppButton>
		</div>
	);
};
