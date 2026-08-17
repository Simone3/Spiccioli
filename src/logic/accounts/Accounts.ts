import type { SpiccioliTranslator } from 'src/i18n/Translations';
import type { Account, AccountType, Institution, LedgerDocument, LedgerId } from 'src/types/LedgerTypes';

/**
 * Everything pure about accounts and institutions: how they are ordered, how an account is written, what points at one, and
 * what makes a name a duplicate.
 *
 * **An account is written *Institution · Account* everywhere but the three screens that give the institution a column or a
 * field of its own**, and a `Cash` account is written with its name alone, having no institution to name. That rule lives here
 * so that every picker, every table and every check names an account the same way.
 *
 * Nothing here is stored: the two counts, the orderings and the picker entries are computed from the document every time they
 * are shown.
 */

/**
 * How many records point at an account, which together are what say whether it can be deleted:
 * a cash account is blocked by its transactions, a `Brokerage` one by its trades.
 */
export interface AccountUsage {
	transactions: number;
	trades: number;
}

// One account, as a picker offers it: closed accounts are carried, marked and after the open ones
export interface AccountPickerEntry {
	id: LedgerId;
	label: string;
	closed: boolean;
}

// Which half of the cash/brokerage boundary a list of accounts is on. No picker in the application ever shows both.
export type AccountSide = 'cash' | 'brokerage';

export interface AccountPickerOptions {
	accounts: readonly Account[];
	institutions: readonly Institution[];
	side: AccountSide;
	translator: SpiccioliTranslator;
}

export interface AccountNameQuery {
	accounts: readonly Account[];
	name: string;

	// The institution the name would live under, which is what it has to be unique within
	institutionId: LedgerId | null;

	// The account being edited, which is never a duplicate of itself
	exceptId?: LedgerId;
}

export interface InstitutionNameQuery {
	institutions: readonly Institution[];
	name: string;
	exceptId?: LedgerId;
}

/**
 * The one comparison every name in the application is ordered and compared with.
 *
 * It is fixed to English rather than taken from the system, exactly as the date format and the separators are a preference
 * rather than a locale. `base` sensitivity is what makes two names that differ only in case or in accents the same name, which
 * is what uniqueness means here: two *Conto Corrente* at one bank are a mistake however they were typed.
 */
const NAME_COLLATOR = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/**
 * Orders two names.
 * @param first The first name.
 * @param second The second name.
 * @returns Negative when the first sorts before the second, positive when after, zero when they are the same name.
 */
export const compareNames = (first: string, second: string): number => {
	return NAME_COLLATOR.compare(first, second);
};

/**
 * Says whether two names are the same name, ignoring case, accents and the whitespace around them.
 * @param first The first name.
 * @param second The second name.
 * @returns Whether they collide.
 */
export const isSameName = (first: string, second: string): boolean => {
	return NAME_COLLATOR.compare(first.trim(), second.trim()) === 0;
};

/**
 * Says whether an account is on the cash side of the boundary.
 * `Brokerage cash` is a cash account despite its name; `Brokerage` is the only type that is not.
 * @param type The account's type.
 * @returns Whether it holds transactions rather than securities.
 */
export const isCashAccountType = (type: AccountType): boolean => {
	return type !== 'brokerage';
};

/**
 * Says whether an account has been retired.
 * @param account The account.
 * @returns Whether it carries a closing date, which is the only retirement mechanism there is.
 */
export const isAccountClosed = (account: Account): boolean => {
	return account.closingDate !== null;
};

/**
 * Indexes the institutions by their identity, which is how every account reaches the name it is written with.
 * @param institutions The institutions.
 * @returns The institutions, by id.
 */
export const indexInstitutions = (institutions: readonly Institution[]): Map<LedgerId, Institution> => {
	return new Map(institutions.map((institution) => {
		return [ institution.id, institution ];
	}));
};

/**
 * Writes an account the way the whole application writes one: *Institution · Account*, or the name alone where there is no
 * institution to name.
 * @param account The account.
 * @param institutions The institutions, by id.
 * @param translator The wording the separator comes from.
 * @returns The account, in one string.
 */
export const formatAccountName = (
	account: Account,
	institutions: ReadonlyMap<LedgerId, Institution>,
	translator: SpiccioliTranslator
): string => {
	const institution = account.institutionId === null ? undefined : institutions.get(account.institutionId);

	if(!institution) {
		return account.name;
	}

	return translator.t('accounts.qualifiedName', { institution: institution.name, name: account.name });
};

/**
 * Counts what points at each account: its transactions and its trades.
 * @param document The ledger.
 * @returns One entry per account, including the accounts nothing points at.
 */
export const countAccountUsage = (document: LedgerDocument): Map<LedgerId, AccountUsage> => {
	const usage = new Map<LedgerId, AccountUsage>();

	for(const account of document.accounts) {
		usage.set(account.id, { transactions: 0, trades: 0 });
	}

	for(const transaction of document.transactions) {
		const entry = usage.get(transaction.accountId);

		if(entry) {
			entry.transactions += 1;
		}
	}

	for(const trade of document.trades) {
		const entry = usage.get(trade.accountId);

		if(entry) {
			entry.trades += 1;
		}
	}

	return usage;
};

/**
 * Counts the accounts pointing at each institution, open and closed alike, which is what says whether one can be deleted.
 * @param accounts The accounts.
 * @param institutions The institutions.
 * @returns One count per institution, including the institutions nothing points at.
 */
export const countAccountsPerInstitution = (
	accounts: readonly Account[],
	institutions: readonly Institution[]
): Map<LedgerId, number> => {
	const counts = new Map<LedgerId, number>();

	for(const institution of institutions) {
		counts.set(institution.id, 0);
	}

	for(const account of accounts) {
		if(account.institutionId !== null) {
			counts.set(account.institutionId, (counts.get(account.institutionId) ?? 0) + 1);
		}
	}

	return counts;
};

/**
 * Orders the accounts table: by institution name, then opening date, then account name, with the accounts belonging to no
 * institution first and the closed ones last whatever else they are.
 * @param accounts The accounts.
 * @param institutions The institutions the names come from.
 * @returns The accounts, ordered.
 */
export const sortAccounts = (accounts: readonly Account[], institutions: readonly Institution[]): Account[] => {
	const byId = indexInstitutions(institutions);

	// An account with no institution sorts under the empty name, which is what puts the cash accounts first
	const institutionName = (account: Account): string => {
		return account.institutionId === null ? '' : byId.get(account.institutionId)?.name ?? '';
	};

	return [ ...accounts ].sort((first, second) => {
		if(isAccountClosed(first) !== isAccountClosed(second)) {
			return isAccountClosed(first) ? 1 : -1;
		}

		const byInstitution = compareNames(institutionName(first), institutionName(second));

		if(byInstitution !== 0) {
			return byInstitution;
		}

		if(first.openingDate !== second.openingDate) {
			return first.openingDate < second.openingDate ? -1 : 1;
		}

		return compareNames(first.name, second.name);
	});
};

/**
 * Orders the institutions list, which is by name and by nothing else.
 * @param institutions The institutions.
 * @returns The institutions, ordered.
 */
export const sortInstitutions = (institutions: readonly Institution[]): Institution[] => {
	return [ ...institutions ].sort((first, second) => {
		return compareNames(first.name, second.name);
	});
};

/**
 * Builds what an account picker offers: one side of the cash/brokerage boundary, each account written *Institution · Account*,
 * the closed ones marked and after the open ones.
 *
 * **Every account picker in the application is this list.** The wrong kind of account is never offered, which is why there is
 * no invalid choice to reject anywhere.
 * @param options The picker's options.
 * @param options.accounts The accounts.
 * @param options.institutions The institutions the names come from.
 * @param options.side Which half of the boundary this picker is on.
 * @param options.translator The wording the name and the closed marker come from.
 * @returns The entries, in the order they are offered in.
 */
export const buildAccountPickerEntries = ({ accounts, institutions, side, translator }: AccountPickerOptions): AccountPickerEntry[] => {
	const byId = indexInstitutions(institutions);
	const wanted = accounts.filter((account) => {
		return isCashAccountType(account.type) === (side === 'cash');
	});

	return wanted.map((account) => {
		const name = formatAccountName(account, byId, translator);
		const closed = isAccountClosed(account);

		return {
			id: account.id,
			label: closed ? translator.t('accounts.closedOption', { name }) : name,
			closed
		};
	}).sort((first, second) => {
		if(first.closed !== second.closed) {
			return first.closed ? 1 : -1;
		}

		return compareNames(first.label, second.label);
	});
};

/**
 * Says whether an account name is already used where it would live: within its institution, or among the accounts that have none.
 * @param query The name and where it would live.
 * @param query.accounts The accounts already recorded.
 * @param query.name The name being entered.
 * @param query.institutionId The institution it would belong to, or null.
 * @param query.exceptId The account being edited, which is never a duplicate of itself.
 * @returns Whether the name collides.
 */
export const isAccountNameTaken = ({ accounts, name, institutionId, exceptId }: AccountNameQuery): boolean => {
	return accounts.some((account) => {
		return account.id !== exceptId && account.institutionId === institutionId && isSameName(account.name, name);
	});
};

/**
 * Says whether an institution name is already recorded.
 * @param query The name and what to compare it against.
 * @param query.institutions The institutions already recorded.
 * @param query.name The name being entered.
 * @param query.exceptId The institution being edited, which is never a duplicate of itself.
 * @returns Whether the name collides.
 */
export const isInstitutionNameTaken = ({ institutions, name, exceptId }: InstitutionNameQuery): boolean => {
	return institutions.some((institution) => {
		return institution.id !== exceptId && isSameName(institution.name, name);
	});
};
