import type { TranslationTree } from 'src/framework/types/TranslationTypes';

/**
 * Every word Spiccioli shows the user, in English.
 * This bundle is the source of truth for the key type, so a key added here has to be translated in every other language
 * before that language compiles, and a key renamed here stops compiling everywhere it is used.
 *
 * It is imported by the Electron main process as well as the renderer, so it must stay free of Node, Electron and React imports.
 */
export const EN_TRANSLATIONS = {
	app: {
		name: 'Spiccioli'
	},

	window: {
		titleWithFile: '{name} — {app}'
	},

	// The two crash screens: the one the renderer draws over itself, and the dialog the main process opens when it has no window to draw in
	crash: {
		title: 'Something went wrong',
		message: 'Spiccioli could not draw this screen. Reloading starts over from the data on disk.',
		reload: 'Reload',
		mainProcessTitle: 'Spiccioli stopped working',
		mainProcessMessage: 'Spiccioli ran into a problem it could not recover from:\n\n{message}'
	},

	menu: {
		file: 'File',
		edit: 'Edit',
		help: 'Help',
		newFile: 'New…',
		openFile: 'Open…',
		openRecent: 'Open Recent',
		noRecentFiles: 'No recent files',
		missingRecentFile: '{name} — not found',
		quit: 'Quit',
		about: 'About {name}',
		aboutVersion: 'Version {version}'
	},

	// The launch screen, which the application always opens with and which never reopens the last file on its own
	launch: {
		subtitle: 'Choose a file to open',
		noRecentFiles: 'No file has been opened yet. Create one, or browse for a file you already have.',
		open: 'Open…',
		newFile: 'New file…',
		recentFileDetail: '{directory} · {openedAt}',
		recentFileMissing: '{directory} · not found — moved or deleted',
		forget: 'Remove from the list',
		dismiss: 'Dismiss'
	},

	upgrade: {
		title: 'This file must be upgraded',
		writtenBy: 'Written by schema',
		thisVersionReads: 'This version reads',
		explanation: {
			one: 'Opening it will convert it to schema {toSchemaVersion}. A copy of the file as it stands is written to the backup folder first, and it is the one backup kept there — move it elsewhere if you want to keep it. If that copy cannot be written the upgrade does not run.',
			other: 'Opening it will convert it to schema {toSchemaVersion}. A copy of the file as it stands is written to the backup folder first, as one of the {count} backups kept there — it will be rotated out in time, so move it elsewhere if you want to keep it. If that copy cannot be written the upgrade does not run.'
		},
		rulesReapplied: 'The categorisation rules are re-applied to every automatically categorised transaction as part of the upgrade. Categories you set by hand are not touched.',
		irreversible: 'After the upgrade, versions of Spiccioli that read schema {fromSchemaVersion} will no longer be able to open it.',
		backupFailed: 'The copy could not be written, so nothing has been changed: {message}',
		cancel: 'Cancel',
		confirm: 'Back up and upgrade',
		retry: 'Retry'
	},

	// What an open file looks like until the sidebar and the eight screens are built
	session: {
		placeholder: 'The file is open and every change is saved to it. The screens that read it are built next; what is here now is the storage layer and the states it has to be able to show.',
		noChangesYet: 'Nothing has been changed yet',
		saved: 'Saved {time}',
		retrying: 'Could not save — retrying, attempt {attempt} of {attempts}',
		retryingExplanation: 'The file could not be written. Trying again — your work is here and nothing has been lost.',
		saveFailed: 'The file could not be written',
		externalModification: {
			one: 'This file was changed while you had it open. That version has been saved to the backup folder as {name}, and your work has been kept. That copy is the one backup kept there, so it will be rotated out in time — move it somewhere else if you want to keep it.',
			other: 'This file was changed while you had it open. That version has been saved to the backup folder as {name}, and your work has been kept. That copy is one of the {count} backups kept there, so it will be rotated out in time — move it somewhere else if you want to keep it.'
		},
		externalModificationNotCopied: 'This file was changed while you had it open, and the version that was on disk could not be copied to the backup folder: {message}. Your work has been kept and the next save overwrites that version.',
		closingBackupFailed: 'The backup of the file you just closed could not be written: {message}',
		dismiss: 'Dismiss'
	},

	// The one error that belongs to no screen, and one of exactly two things in the application that block
	writeFailure: {
		title: 'The file cannot be written',
		subtitle: '{name} · after 5 attempts',
		location: 'Location',
		systemSaid: 'The system said',
		reassurance: 'Everything you have done is still here, in memory. Free the disk, reconnect the volume or unlock the file, and then retry.',
		retry: 'Retry'
	},

	// What the main process says about the file. These reach the user as "what the system said", so they are wording rather than developer text.
	storage: {
		fileTypeName: 'Spiccioli ledger',
		openDialogTitle: 'Open a ledger',
		newDialogTitle: 'Where should the new ledger go?',
		newFileDefaultName: 'finances',
		writeTimedOut: 'The write did not finish within {seconds} seconds.',
		noFileOpen: 'No ledger file is open.'
	},

	// What the reader did not understand about a file, stated on the launch screen with the other files still openable.
	// None of these ever prints a value: the figure a refusal was raised on is an amount and the text is a description.
	refusal: {
		locationFile: 'the file',
		locationRow: '{entity}, row {position}',
		entity: {
			institutions: 'institutions',
			accounts: 'accounts',
			securities: 'securities',
			prices: 'prices',
			transactions: 'transactions',
			trades: 'trades',
			contracts: 'contracts',
			contractYears: 'contract years',
			payslips: 'payslips',
			categories: 'categories',
			rules: 'rules'
		},
		reason: {
			malformedJson: 'The file is not valid JSON, so none of it could be read.',
			wrongType: 'In {location}, “{field}” holds something of a kind this version does not expect.',
			unknownKey: 'In {location}, the file carries a key this version has never heard of: “{field}”.',
			missingKey: 'In {location}, the file is missing a key this version requires: “{field}”.',
			unknownEnumValue: 'In {location}, “{field}” holds a value that is not one of the {enumName} this version knows.',
			unknownCategory: 'In {location}, the file holds a category this version does not know.',
			nonIntegerFigure: 'In {location}, “{field}” is not a whole number in the minor units that field is stored in.',
			malformedDate: 'In {location}, “{field}” is not a day written as YYYY-MM-DD.',
			duplicateKey: 'In {location}, two records cannot be told apart: they share the key other records point at.',
			danglingReference: 'In {location}, “{field}” points at a record the file does not hold.',
			unsupportedSchemaVersion: 'The file was written by schema version {foundSchemaVersion}, and this version of Spiccioli reads schema version {supportedSchemaVersion}. A newer file cannot be opened by an older version.'
		}
	},

	// The twenty-seven categories seeded into every new file. They are wording, so they live here; the seed copies them into the
	// file as it writes it, and the ids they are stored under are fixed in code.
	categories: {
		salary: 'Salary',
		pensionFundContribution: 'Pension fund contribution',
		reimbursement: 'Reimbursement',
		giftReceived: 'Gift received',
		otherIncome: 'Other income',
		interestDividendsAndBonuses: 'Interest, dividends & bonuses',
		voucherTopUp: 'Voucher top-up',
		restaurantsAndBars: 'Restaurants & bars',
		groceries: 'Groceries',
		travel: 'Travel',
		homeAndHousehold: 'Home & household',
		rentAndCondominiumFees: 'Rent & condominium fees',
		electricity: 'Electricity',
		homeInternet: 'Home internet',
		mobileAndPhone: 'Mobile & phone',
		entertainment: 'Entertainment',
		otherExpense: 'Other expense',
		bankFees: 'Bank fees',
		incomeAndOtherTaxes: 'Income & other taxes',
		wealthTax: 'Wealth tax',
		cultureAndEducation: 'Culture & education',
		healthAndPersonalCare: 'Health & personal care',
		technologyAndDevices: 'Technology & devices',
		internalTransfer: 'Internal transfer',
		securitiesPurchase: 'Securities purchase',
		securitiesSale: 'Securities sale',
		valueAdjustment: 'Value adjustment'
	}
} as const satisfies TranslationTree;
