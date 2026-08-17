import 'src/components/accounts/AccountsScreen.css';
import { useMemo, useState, type ReactElement } from 'react';
import { AccountForm, type AccountFormValues } from 'src/components/accounts/AccountForm';
import { AccountsTable } from 'src/components/accounts/AccountsTable';
import { InstitutionForm, type InstitutionFormValues } from 'src/components/accounts/InstitutionForm';
import { InstitutionsTable } from 'src/components/accounts/InstitutionsTable';
import { AppButton } from 'src/components/common/AppButton';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { EmptyState } from 'src/components/common/EmptyState';
import { TabBar } from 'src/components/common/TabBar';
import { ScreenLayout } from 'src/components/shell/ScreenLayout';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import {
	countAccountsPerInstitution,
	countAccountUsage,
	formatAccountName,
	indexInstitutions,
	isAccountClosed,
	sortAccounts,
	sortInstitutions,
	type AccountUsage
} from 'src/logic/accounts/Accounts';
import { createLedgerId } from 'src/logic/ledger/LedgerDocument';
import type { Account, Institution, LedgerId } from 'src/types/LedgerTypes';

/**
 * Accounts, which is the spine every other screen hangs off: transactions, balances and net worth all hang off an account.
 *
 * Two tabs, and **each one creates what it lists** — *Add account* on the first, *Add institution* on the second. They are two
 * independent forms and neither opens the other: the account form picks from the institutions already recorded and cannot make
 * one.
 *
 * **A deletion is refused while something points at the record**, and the refusal says what points at it, above the list and
 * never in a modal. Closing an account is what retiring one looks like, and it changes no total.
 */

type AccountsScreenTab = 'accounts' | 'institutions';

// The record a form is open on. An undefined record is one being created; an undefined draft is a form that is not open.
interface AccountDraft {
	account: Account | undefined;
}

interface InstitutionDraft {
	institution: Institution | undefined;
}

const NO_USAGE: AccountUsage = { transactions: 0, trades: 0 };

/**
 * The Accounts screen.
 * @returns The screen.
 */
export const AccountsScreen = (): ReactElement => {
	const translator = useTranslator();
	const { t, formatList } = translator;
	const { document, updateDocument } = useLedger();
	const [ tab, setTab ] = useState<AccountsScreenTab>('accounts');
	const [ accountDraft, setAccountDraft ] = useState<AccountDraft | undefined>(undefined);
	const [ institutionDraft, setInstitutionDraft ] = useState<InstitutionDraft | undefined>(undefined);
	const [ accountToDelete, setAccountToDelete ] = useState<Account | undefined>(undefined);
	const [ institutionToDelete, setInstitutionToDelete ] = useState<Institution | undefined>(undefined);
	const [ refusal, setRefusal ] = useState<string | undefined>(undefined);

	const accounts = useMemo(() => {
		return document?.accounts ?? [];
	}, [ document ]);

	const institutions = useMemo(() => {
		return document?.institutions ?? [];
	}, [ document ]);

	const institutionsById = useMemo(() => {
		return indexInstitutions(institutions);
	}, [ institutions ]);

	const usage = useMemo((): ReadonlyMap<LedgerId, AccountUsage> => {
		return document ? countAccountUsage(document) : new Map<LedgerId, AccountUsage>();
	}, [ document ]);

	const accountCounts = useMemo(() => {
		return countAccountsPerInstitution(accounts, institutions);
	}, [ accounts, institutions ]);

	const orderedAccounts = useMemo(() => {
		return sortAccounts(accounts, institutions);
	}, [ accounts, institutions ]);

	const orderedInstitutions = useMemo(() => {
		return sortInstitutions(institutions);
	}, [ institutions ]);

	const openAccountCount = accounts.filter((account) => {
		return !isAccountClosed(account);
	}).length;

	const summary = t('accounts.summary', {
		accounts: t('accounts.count', { count: accounts.length }),
		open: t('accounts.openCount', { count: openAccountCount }),
		institutions: t('accounts.institutionCount', { count: institutions.length })
	});

	const openAccountForm = (account: Account | undefined): void => {
		setRefusal(undefined);
		setAccountDraft({ account });
	};

	const openInstitutionForm = (institution: Institution | undefined): void => {
		setRefusal(undefined);
		setInstitutionDraft({ institution });
	};

	const saveAccount = (values: AccountFormValues): void => {
		const existing = accountDraft?.account;

		updateDocument((current) => {
			return {
				...current,
				accounts: existing ?
					current.accounts.map((account) => {
						return account.id === existing.id ? { ...existing, ...values } : account;
					}) :
					[ ...current.accounts, { id: createLedgerId(), ...values } ]
			};
		});
		setAccountDraft(undefined);
	};

	const saveInstitution = (values: InstitutionFormValues): void => {
		const existing = institutionDraft?.institution;

		updateDocument((current) => {
			return {
				...current,
				institutions: existing ?
					current.institutions.map((institution) => {
						return institution.id === existing.id ? { ...existing, ...values } : institution;
					}) :
					[ ...current.institutions, { id: createLedgerId(), ...values } ]
			};
		});
		setInstitutionDraft(undefined);
	};

	// A cash account is blocked by its transactions and a brokerage one by its trades, and the refusal says which and how many
	const requestAccountDeletion = (account: Account): void => {
		const counts = usage.get(account.id) ?? NO_USAGE;
		const name = formatAccountName(account, institutionsById, translator);

		if(counts.transactions > 0) {
			setRefusal(t('accounts.deleteBlockedByTransactions', { name, count: counts.transactions }));

			return;
		}

		if(counts.trades > 0) {
			setRefusal(t('accounts.deleteBlockedByTrades', { name, count: counts.trades }));

			return;
		}

		setRefusal(undefined);
		setAccountToDelete(account);
	};

	// An institution is blocked by the accounts pointing at it, closed ones included, and the refusal names them
	const requestInstitutionDeletion = (institution: Institution): void => {
		const pointing = accounts.filter((account) => {
			return account.institutionId === institution.id;
		});

		if(pointing.length > 0) {
			setRefusal(t('institutions.deleteBlocked', {
				name: institution.name,
				count: pointing.length,
				accounts: formatList(pointing.map((account) => {
					return account.name;
				}))
			}));

			return;
		}

		setRefusal(undefined);
		setInstitutionToDelete(institution);
	};

	const deleteAccount = (account: Account): void => {
		updateDocument((current) => {
			return {
				...current,
				accounts: current.accounts.filter((candidate) => {
					return candidate.id !== account.id;
				})
			};
		});
		setAccountToDelete(undefined);
	};

	const deleteInstitution = (institution: Institution): void => {
		updateDocument((current) => {
			return {
				...current,
				institutions: current.institutions.filter((candidate) => {
					return candidate.id !== institution.id;
				})
			};
		});
		setInstitutionToDelete(undefined);
	};

	const isAccountsTab = tab === 'accounts';
	const isListEmpty = (isAccountsTab ? accounts : institutions).length === 0;

	// Each tab creates what it lists, and the two forms are independent: neither opens the other
	const addToTab = (): void => {
		if(isAccountsTab) {
			openAccountForm(undefined);
		}
		else {
			openInstitutionForm(undefined);
		}
	};

	const addButton = <AppButton variant='primary' onClick={addToTab}>{isAccountsTab ? t('accounts.add') : t('institutions.add')}</AppButton>;

	// The empty state carries the button that fills the screen, so the heading does not offer the same control twice
	const actions = isListEmpty ? undefined : addButton;

	return (
		<ScreenLayout
			title={t('screens.accounts')}
			subtitle={isAccountsTab ? summary : t('institutions.summary', { count: institutions.length })}
			actions={actions}>
			<TabBar
				label={t('screens.accounts')}
				active={tab}
				tabs={[
					{ key: 'accounts', label: t('accounts.tabs.accounts') },
					{ key: 'institutions', label: t('accounts.tabs.institutions') }
				]}
				onSelect={(key) => {
					setRefusal(undefined);
					setTab(key as AccountsScreenTab);
				}}/>

			{refusal && (
				<div className='accounts-screen-refusal' role='alert'>
					<p>{refusal}</p>
					<button
						type='button'
						className='accounts-screen-refusal-dismiss'
						onClick={() => {
							setRefusal(undefined);
						}}>
						{t('notice.dismiss')}
					</button>
				</div>
			)}

			{isAccountsTab && (accounts.length === 0 ?
				<EmptyState message={t('emptyState.accounts')}>{addButton}</EmptyState> :
				<AccountsTable
					accounts={orderedAccounts}
					institutions={institutionsById}
					usage={usage}
					summary={summary}
					onEdit={openAccountForm}
					onDelete={requestAccountDeletion}/>)}

			{!isAccountsTab && (institutions.length === 0 ?
				<EmptyState message={t('emptyState.institutions')}>{addButton}</EmptyState> :
				<InstitutionsTable
					institutions={orderedInstitutions}
					accountCounts={accountCounts}
					onEdit={openInstitutionForm}
					onDelete={requestInstitutionDeletion}/>)}

			{accountDraft && (
				<AccountForm
					account={accountDraft.account}
					onSave={saveAccount}
					onCancel={() => {
						setAccountDraft(undefined);
					}}/>
			)}

			{institutionDraft && (
				<InstitutionForm
					institution={institutionDraft.institution}
					onSave={saveInstitution}
					onCancel={() => {
						setInstitutionDraft(undefined);
					}}/>
			)}

			{accountToDelete && (
				<ConfirmDialog
					danger
					title={t('accounts.deleteTitle')}
					message={t('accounts.deleteMessage', { name: formatAccountName(accountToDelete, institutionsById, translator) })}
					confirmLabel={t('accounts.deleteConfirm')}
					onConfirm={() => {
						deleteAccount(accountToDelete);
					}}
					onCancel={() => {
						setAccountToDelete(undefined);
					}}/>
			)}

			{institutionToDelete && (
				<ConfirmDialog
					danger
					title={t('institutions.deleteTitle')}
					message={t('institutions.deleteMessage', { name: institutionToDelete.name })}
					confirmLabel={t('institutions.deleteConfirm')}
					onConfirm={() => {
						deleteInstitution(institutionToDelete);
					}}
					onCancel={() => {
						setInstitutionToDelete(undefined);
					}}/>
			)}
		</ScreenLayout>
	);
};
