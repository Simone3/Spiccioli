import type { ReactElement, ReactNode } from 'react';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { Category, LedgerId } from 'src/types/LedgerTypes';

/**
 * The twenty-seven categories, and the only place the whole taxonomy is visible at once.
 *
 * **Read-only**: they are seeded into every file and adding, renaming or removing one is a change to the application rather than
 * a setting. **This list is alphabetical**, like every picker and every filter; the report is the one table that reads in the
 * stored `order` instead.
 *
 * **Neither `role` nor `order` is shown.** Both are wiring rather than facts about the money — nothing on any screen can set
 * them — and a column of mostly blank roles would read as a setting somebody forgot to fill in.
 */

export interface CategoryListTableProps {

	// The categories, already alphabetical
	categories: readonly Category[];

	// How many transactions each one holds, which is a live count and not a stored figure
	counts: ReadonlyMap<LedgerId, number>;

	footer: ReactNode;
}

/**
 * The category list.
 * @param props The table's props.
 * @param props.categories The categories, alphabetically.
 * @param props.counts How many transactions each one holds.
 * @param props.footer What goes under the rule.
 * @returns The table.
 */
export const CategoryListTable = ({ categories, counts, footer }: CategoryListTableProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	const columns: readonly DataTableColumn<Category>[] = [
		{
			key: 'name',
			header: t('categoryList.columns.name'),
			render: (category) => {
				return category.name;
			}
		},
		{
			key: 'type',
			header: t('categoryList.columns.type'),
			render: (category) => {
				return <Chip tone='quiet'>{t(`categoryTypes.${category.type}`)}</Chip>;
			}
		},
		{
			key: 'receiptTracked',
			header: t('categoryList.columns.receiptTracked'),
			render: (category) => {
				// A category nothing is expected to document says so with the dash every column of an inapplicable field uses
				return category.receiptTracked ?
					<span className='categories-screen-tracked' role='img' aria-label={t('categoryList.tracked')}>✓</span> :
					t('table.notApplicable');
			}
		},
		{
			key: 'transactions',
			header: t('categoryList.columns.transactions'),
			numeric: true,
			render: (category) => {
				return formatter.integer(counts.get(category.id) ?? 0);
			}
		}
	];

	return (
		<DataTable
			columns={columns}
			rows={categories}
			label={t('categoryList.table')}
			footer={footer}
			getRowKey={(category) => {
				return category.id;
			}}/>
	);
};
