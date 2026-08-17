import type { ReactElement } from 'react';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { RowMenu } from 'src/components/common/RowMenu';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { Institution, LedgerId } from 'src/types/LedgerTypes';

/**
 * The institutions, by name, with the accounts count that says whether one can be deleted.
 *
 * An institution has no balance, no history and no screen of its own: it exists to group accounts and to carry the flat sell
 * fee the liquidation estimate charges once per holding. **It is never retired** — when its last account closes it simply stops
 * appearing anywhere that matters, and it stays here because the closed account still points at it.
 */

export interface InstitutionsTableProps {

	// Already ordered by name, which is the only order there is
	institutions: readonly Institution[];

	// How many accounts point at each institution, open and closed alike
	accountCounts: ReadonlyMap<LedgerId, number>;

	onEdit: (institution: Institution) => void;
	onDelete: (institution: Institution) => void;
}

/**
 * The institutions table.
 * @param props The table's props.
 * @param props.institutions The institutions, ordered.
 * @param props.accountCounts How many accounts point at each.
 * @param props.onEdit What correcting a row does.
 * @param props.onDelete What deleting a row does.
 * @returns The table.
 */
export const InstitutionsTable = ({ institutions, accountCounts, onEdit, onDelete }: InstitutionsTableProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	const columns: readonly DataTableColumn<Institution>[] = [
		{
			key: 'name',
			header: t('institutions.columns.name'),
			render: (institution) => {
				return institution.name;
			}
		},
		{
			key: 'defaultSellFee',
			header: t('institutions.columns.defaultSellFee'),
			numeric: true,
			render: (institution) => {
				return formatter.amount(institution.defaultSellFee);
			}
		},
		{
			key: 'accounts',
			header: t('institutions.columns.accounts'),
			numeric: true,
			render: (institution) => {
				return formatter.integer(accountCounts.get(institution.id) ?? 0);
			}
		},
		{
			key: 'notes',
			header: t('institutions.columns.notes'),
			render: (institution) => {
				return <span className='accounts-screen-notes'>{institution.notes}</span>;
			}
		},
		{
			key: 'actions',
			header: '',
			render: (institution) => {
				return (
					<RowMenu
						label={t('institutions.rowMenu', { name: institution.name })}
						actions={[
							{
								key: 'edit',
								label: t('rowMenu.edit'),
								onSelect: () => {
									onEdit(institution);
								}
							},
							{
								key: 'delete',
								label: t('rowMenu.delete'),
								danger: true,
								onSelect: () => {
									onDelete(institution);
								}
							}
						]}/>
				);
			}
		}
	];

	const totalAccounts = institutions.reduce((running, institution) => {
		return running + (accountCounts.get(institution.id) ?? 0);
	}, 0);

	const footer = t('institutions.footer', {
		institutions: t('institutions.summary', { count: institutions.length }),
		accounts: t('institutions.accountCount', { count: totalAccounts })
	});

	return (
		<DataTable
			columns={columns}
			rows={institutions}
			label={t('institutions.table')}
			footer={footer}
			getRowKey={(institution) => {
				return institution.id;
			}}/>
	);
};
