import { makeAccount, makeFullDocument, makeInstitution, makeTrade, makeTransaction } from '../testUtils';
import { createSpiccioliTranslator } from 'src/i18n/Translations';
import {
	buildAccountPickerEntries,
	countAccountsPerInstitution,
	countAccountUsage,
	formatAccountName,
	indexInstitutions,
	isAccountNameTaken,
	isCashAccountType,
	isInstitutionNameTaken,
	sortAccounts,
	sortInstitutions
} from 'src/logic/accounts/Accounts';
import type { Account, Institution } from 'src/types/LedgerTypes';

const translator = createSpiccioliTranslator('en');

const fineco = makeInstitution({ id: 'fineco', name: 'Fineco' });

const amundi = makeInstitution({ id: 'amundi', name: 'Amundi' });

const institutions: Institution[] = [ fineco, amundi ];

describe('how an account is written', () => {
	test('carries its institution before its name', () => {
		const account = makeAccount({ institutionId: 'fineco' });

		expect(formatAccountName(account, indexInstitutions(institutions), translator)).toBe('Fineco · Conto Corrente');
	});

	test('is the name alone where there is no institution to name', () => {
		const wallet = makeAccount({ id: 'wallet', name: 'Wallet', type: 'cash', institutionId: null });

		expect(formatAccountName(wallet, indexInstitutions(institutions), translator)).toBe('Wallet');
	});
});

describe('the accounts ordering', () => {
	const wallet = makeAccount({ id: 'wallet', name: 'Wallet', type: 'cash', institutionId: null, openingDate: '2020-01-01' });
	const pension = makeAccount({ id: 'pension', name: 'Fondo Pensione', institutionId: 'amundi', openingDate: '2017-09-01' });
	const older = makeAccount({ id: 'older', name: 'Conto Titoli', institutionId: 'fineco', openingDate: '2016-01-01' });
	const newer = makeAccount({ id: 'newer', name: 'Conto Corrente', institutionId: 'fineco', openingDate: '2018-03-14' });
	const closed = makeAccount({ id: 'closed', name: 'Conto Chiuso', institutionId: 'amundi', openingDate: '2016-01-01', closingDate: '2021-06-30' });

	const ordered = (accounts: readonly Account[]): string[] => {
		return sortAccounts(accounts, institutions).map((account) => {
			return account.id;
		});
	};

	test('puts the accounts belonging to no institution first', () => {
		expect(ordered([ pension, wallet ])).toEqual([ 'wallet', 'pension' ]);
	});

	test('orders by institution name, then opening date, then account name', () => {
		expect(ordered([ newer, pension, older ])).toEqual([ 'pension', 'older', 'newer' ]);
	});

	test('sorts closed accounts last whatever else they are', () => {
		expect(ordered([ closed, newer, wallet ])).toEqual([ 'wallet', 'newer', 'closed' ]);
	});

	test('leaves the array it was given alone', () => {
		const given = [ newer, pension ];
		sortAccounts(given, institutions);

		expect(given[0].id).toBe('newer');
	});

	test('orders institutions by name and by nothing else', () => {
		expect(sortInstitutions(institutions).map((institution) => {
			return institution.name;
		})).toEqual([ 'Amundi', 'Fineco' ]);
	});
});

describe('what points at an account', () => {
	test('counts the transactions and the trades of every account, including the ones nothing points at', () => {
		const document = makeFullDocument();
		const usage = countAccountUsage({
			...document,
			transactions: [ makeTransaction(), makeTransaction({ id: 'transaction-2' }) ],
			trades: [ makeTrade() ]
		});

		expect(usage.get('account-1')).toEqual({ transactions: 2, trades: 0 });
		expect(usage.get('account-2')).toEqual({ transactions: 0, trades: 1 });
	});

	test('counts the accounts of every institution, closed ones included', () => {
		const accounts = [
			makeAccount({ id: 'one', institutionId: 'fineco' }),
			makeAccount({ id: 'two', institutionId: 'fineco', closingDate: '2021-06-30' }),
			makeAccount({ id: 'three', institutionId: null, type: 'cash' })
		];

		const counts = countAccountsPerInstitution(accounts, institutions);

		expect(counts.get('fineco')).toBe(2);
		expect(counts.get('amundi')).toBe(0);
	});
});

describe('what an account picker offers', () => {
	const accounts = [
		makeAccount({ id: 'cash', name: 'Wallet', type: 'cash', institutionId: null }),
		makeAccount({ id: 'current', name: 'Conto Corrente', institutionId: 'fineco' }),
		makeAccount({ id: 'closed', name: 'Conto Chiuso', institutionId: 'amundi', closingDate: '2021-06-30' }),
		makeAccount({ id: 'dossier', name: 'Dossier Titoli', type: 'brokerage', institutionId: 'fineco', openingBalance: 0 })
	];

	test('offers one side of the boundary and never the other', () => {
		const cash = buildAccountPickerEntries({ accounts, institutions, side: 'cash', translator });

		expect(cash.map((entry) => {
			return entry.id;
		})).not.toContain('dossier');

		const brokerage = buildAccountPickerEntries({ accounts, institutions, side: 'brokerage', translator });

		expect(brokerage.map((entry) => {
			return entry.id;
		})).toEqual([ 'dossier' ]);
	});

	test('marks the closed accounts and puts them after the open ones', () => {
		const entries = buildAccountPickerEntries({ accounts, institutions, side: 'cash', translator });

		expect(entries.map((entry) => {
			return entry.label;
		})).toEqual([ 'Fineco · Conto Corrente', 'Wallet', 'Amundi · Conto Chiuso — closed' ]);
		expect(entries[2].closed).toBe(true);
	});
});

describe('the uniqueness rules', () => {
	const accounts = [
		makeAccount({ id: 'one', name: 'Conto Corrente', institutionId: 'fineco' }),
		makeAccount({ id: 'two', name: 'Wallet', type: 'cash', institutionId: null })
	];

	test('take two accounts of one name at two institutions, and refuse two at the same one', () => {
		expect(isAccountNameTaken({ accounts, name: 'Conto Corrente', institutionId: 'amundi' })).toBe(false);
		expect(isAccountNameTaken({ accounts, name: 'Conto Corrente', institutionId: 'fineco' })).toBe(true);
	});

	test('read a name the same however it was typed, and never count a record as its own duplicate', () => {
		expect(isAccountNameTaken({ accounts, name: '  conto corrente ', institutionId: 'fineco' })).toBe(true);
		expect(isAccountNameTaken({ accounts, name: 'Conto Corrente', institutionId: 'fineco', exceptId: 'one' })).toBe(false);
	});

	test('hold among the accounts that have no institution at all', () => {
		expect(isAccountNameTaken({ accounts, name: 'Wallet', institutionId: null })).toBe(true);
	});

	test('refuse a second institution of the same name', () => {
		expect(isInstitutionNameTaken({ institutions, name: 'FINECO' })).toBe(true);
		expect(isInstitutionNameTaken({ institutions, name: 'Fineco', exceptId: 'fineco' })).toBe(false);
	});
});

describe('the cash and brokerage boundary', () => {
	test('puts brokerage cash on the cash side, its name notwithstanding', () => {
		expect(isCashAccountType('brokerage-cash')).toBe(true);
		expect(isCashAccountType('brokerage')).toBe(false);
	});
});
