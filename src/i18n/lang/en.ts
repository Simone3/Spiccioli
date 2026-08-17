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

	// The sidebar and the eight screens it lists
	screens: {
		navigation: 'Screens',
		portfolio: 'Portfolio',
		accounts: 'Accounts',
		transactions: 'Transactions',
		bulkImport: 'Import transactions',
		categories: 'Categories',
		investments: 'Investments',
		salaries: 'Salaries',
		checks: 'Checks',
		settings: 'Settings',
		notBuiltYet: 'This screen is not built yet. Everything the file holds is safe and is read by the screens as each one is built.'
	},

	// What a screen with nothing on it says. Every one of them names the action that fills it, and none of them says "no data".
	emptyState: {
		portfolio: 'Nothing here yet — add the accounts you want to track.',
		accounts: 'Add the first account — a current account is the usual place to start.',
		transactions: 'Import a bank export, or add a row by hand.',
		bulkImport: 'There is no account to import into yet. Add a cash account first, and the import will offer it.',
		categories: 'Nothing is categorised automatically yet — add a rule, then apply the list and see what it would catch.',
		investments: 'Record a purchase to start tracking holdings.',
		salaries: 'Add the employer, its months per year and its hours per day — everything on the other tab divides by them.',
		goToAccounts: 'Go to Accounts',
		goToImport: 'Import a bank export'
	},

	// The preferences, which belong to the installation and not to the open file
	settings: {
		preferenceCount: {
			one: '1 preference',
			other: '{count} preferences'
		},
		scopeTitle: 'These settings belong to Spiccioli, not to the open file.',
		scopeExplanation: 'They are stored with the application and apply to every file you open.',
		formats: 'Formats',
		thresholds: 'Thresholds',
		file: 'File',
		dateFormat: 'Date format',
		decimalSeparator: 'Decimal separator',
		thousandsSeparator: 'Thousands separator',
		separatorsMustDiffer: 'The decimal and thousands separators must differ, so this one was not applied.',
		separators: {
			comma: ', comma',
			dot: '. dot',
			space: 'space',
			none: 'none'
		},
		defaultTaxRate: 'Default tax rate',
		priceStalenessDays: 'Stale price after',
		pensionRevaluationMonths: 'Revalue pension every',
		receiptPendingMonths: 'Receipt pending for',
		transferMatchWindowDays: 'Transfer match window',
		tradeMatchWindowDays: 'Trade match window',
		backupCount: 'Backups kept',
		units: {
			days: 'days',
			months: 'months'
		},
		dataFile: 'Data file',
		backupFolder: 'Backup folder',
		pathUnknown: 'No file is open'
	},

	// What a field says when it will not take a value. The message sits where the offending value is, and never in a modal.
	field: {
		required: 'This is required.',
		tooLow: 'This cannot be less than {minimum}.',
		tooHigh: 'This cannot be more than {maximum}.'
	},

	rowMenu: {
		nothingToDo: 'Nothing to do here'
	},

	dialog: {
		cancel: 'Cancel'
	},

	inlineEdit: {
		save: 'Save',
		cancel: 'Cancel'
	},

	filters: {
		clear: 'Clear filters'
	},

	// What the file has to say while it is open, on whichever screen the user is on
	session: {
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
