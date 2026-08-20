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
		view: 'View',
		window: 'Window',
		help: 'Help',

		// Names the whole drawn menu bar for anything reading the window out, which sees a row of buttons and nothing saying what they are
		bar: 'Application menu',

		newFile: 'New…',
		openFile: 'Open…',
		openRecent: 'Open Recent',
		noRecentFiles: 'No recent files',
		missingRecentFile: '{name} — not found',
		quit: 'Quit',
		about: 'About {name}',
		aboutVersion: 'Version {version}',

		// The entries the native menu takes from an Electron role, worded here for the menu bar Spiccioli draws itself
		undo: 'Undo',
		redo: 'Redo',
		cut: 'Cut',
		copy: 'Copy',
		paste: 'Paste',
		selectAll: 'Select All',
		resetZoom: 'Actual Size',
		zoomIn: 'Zoom In',
		zoomOut: 'Zoom Out',
		toggleFullScreen: 'Toggle Full Screen',
		minimize: 'Minimize',
		close: 'Close'
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
		settings: 'Settings'
	},

	// What a screen with nothing on it says. Every one of them names the action that fills it, and none of them says "no data".
	emptyState: {
		portfolio: 'Nothing here yet — add the accounts you want to track.',
		accounts: 'Add the first account — a current account is the usual place to start.',
		institutions: 'Only a Cash account does without one — that is what physical cash is. Add one when a bank turns up.',
		transactions: 'Import a bank export, or add a row by hand.',
		transactionsFiltered: 'No transaction matches these filters.',
		bulkImport: 'There is no account to import into yet. Add a cash account first, and the import will offer it.',
		categories: 'Nothing is categorised automatically yet — add a rule, then apply the list and see what it would catch.',
		report: 'There is nothing to report yet — the table fills in as transactions arrive.',
		investments: 'Record a purchase to start tracking holdings.',
		holdings: 'Nothing is held yet. Record a purchase and the position appears here, valued at whatever it was last priced at.',
		purchases: 'Record the first purchase — the security can be created on the same form.',
		sales: 'Nothing has been sold yet. A sale is recorded here, with the tax the broker actually withheld.',
		tradesFiltered: 'No trade matches these filters.',
		securities: 'Add the first security, or let the purchase form create one while you record the trade.',
		salaries: 'Add the employer, its months per year and its hours per day — everything on the other tab divides by them.',
		payslips: 'Nothing has been recorded against this contract yet — add the first payslip and its year fills itself in.',
		payslipsOfYear: 'Nothing was recorded for {year}. Add a payslip, or pick another year in the table above.',
		goToAccounts: 'Go to Accounts',
		goToImport: 'Import a bank export',
		goToTransactions: 'Go to Transactions'
	},

	// The Portfolio screen, which is every other screen's output and states nothing of its own. Every note here is one plain
	// string: it is what the control beside the figure is called as well as what the popup says, so it reads the same way to
	// somebody hearing it as to somebody seeing it.
	portfolio: {
		failingChecks: {
			one: '1 check is failing.',
			other: '{count} checks are failing.'
		},
		reviewChecks: 'Review',
		netWorth: 'Net worth',
		netWorthChart: 'Net worth over time',

		// The four lines beneath the headline, which add up to it
		lines: {
			cash: 'Cash',
			securitiesAtCost: 'Securities at cost',
			unrealisedNetGain: 'Unrealised net investment gain',
			pensionNet: 'Pension funds, net'
		},

		// One note per line, and the four together are the estimation caveat split along the lines it actually applies to. Two
		// of them say what the figure is and nothing more, which is where the estimation has not reached yet; the two that
		// carry it open by saying so.
		notes: {
			cash: 'Every cash account that is not a pension fund, at its opening balance plus every transaction on it.',
			securitiesAtCost: 'Every holding still open, valued at what was paid for it with the purchase fees included.',
			unrealisedNetGain: 'An estimate. What selling every holding today would add to the portfolio or take out of it, after the capital-gains tax and the sell fee. The tax is worked out one holding at a time, so a loss on one does not reduce the tax on another, and the fee is charged once per holding — both push this figure down. The gross picture is on Investments.',
			pensionNet: 'An estimate. Every pension fund at its balance less the exit tax, which falls on what was paid in rather than on what the fund earned, at a rate typed by hand. Netting a fund for tax does not make it liquid: this is still money that cannot be had before retirement.',
			balance: 'Opening balance plus every transaction on standard accounts. A pension fund is shown after its exit tax. A brokerage account reads as the net value of its holdings, after the capital-gains tax and the sell fee.'
		},

		// What the portfolio has gained and lost by being kept in banks and funds instead of as cash. Nothing on this card is
		// an estimate, which is the whole of what it has and the card above it has not.
		gains: {
			title: 'Gains and costs, all time',
			roles: {
				'bank-fees': 'Bank fees',
				'wealth-tax': 'Wealth tax',
				'interest-and-dividends': 'Interest, dividends & bonuses',
				'value-adjustment': 'Value adjustments'
			},
			realisedGain: 'Realised gain on sales',
			total: 'Total',
			omitted: {
				one: '1 sale has no average cost behind it and is left out of this figure and of the total.',
				other: '{count} sales have no average cost behind them and are left out of this figure and of the total.'
			},
			omittedLink: 'Checks 8 and 9 name the trades'
		},

		// The pie and the list beside it, over the seven cash types and the four security types
		types: {
			title: 'Breakdown by type',
			chart: 'Portfolio split by type',
			sliceCount: {
				one: 'type',
				other: 'types'
			},
			noShare: '0,0%',
			nothingPositive: 'No type is worth anything to divide up, so there is no shape to draw. Every amount is listed beside it.'
		},

		// The line, the two states the tooltip names it in, and the note under it about the rates every point is taken at
		chart: {
			title: 'Net worth over time',
			monthOfYear: '{month}/{year}',
			fromPrices: 'Holdings, if any, at their latest known price',
			fromCost: 'At least one holding at cost — no price to value it at',
			rates: 'Net of capital-gains tax, sell fees and pension exit tax at today’s rates',
			needsHistory: 'There is no history to draw yet — the line fills in as transactions and trades arrive. The figures above are the opening balances.'
		},

		// The one place besides the Accounts table where every account is shown together, and the one that carries the balance
		accounts: {
			title: 'Breakdown by account',
			table: 'Balances by account',
			columns: {
				institution: 'Institution',
				account: 'Account',
				type: 'Type',
				balance: 'Balance'
			},
			footer: '{accounts} · {closed} closed · {institutions}'
		}
	},

	// The Accounts screen. An account is written "Institution · Account" everywhere in the application; this screen, the
	// Portfolio breakdown by account and the account form are the three that give the institution a column or a field of its own.
	accounts: {
		tabs: {
			accounts: 'Accounts',
			institutions: 'Institutions'
		},
		add: 'Add account',
		table: 'Accounts',
		qualifiedName: '{institution} · {name}',
		closedOption: '{name} — closed',
		summary: '{accounts} · {open} · {institutions}',
		footer: '{summary} · {transactions} · {trades}',
		count: {
			one: '1 account',
			other: '{count} accounts'
		},
		openCount: '{count} open',
		institutionCount: {
			one: '1 institution',
			other: '{count} institutions'
		},
		transactionCount: {
			one: '1 transaction',
			other: '{count} transactions'
		},
		tradeCount: {
			one: '1 trade',
			other: '{count} trades'
		},
		columns: {
			name: 'Name',
			institution: 'Institution',
			type: 'Type',
			openingBalance: 'Opening balance',
			exitTax: 'Exit tax',
			opened: 'Opened',
			closed: 'Closed',
			transactions: 'Transactions',
			trades: 'Trades',
			notes: 'Notes'
		},
		types: {
			'current-account': 'Current account',
			cash: 'Cash',
			'brokerage-cash': 'Brokerage cash',
			'deposit-account': 'Deposit account',
			'term-deposit': 'Term deposit',
			'pension-fund': 'Pension fund',
			voucher: 'Voucher',
			brokerage: 'Brokerage'
		},
		rowMenu: 'What can be done to {name}',
		deleteTitle: 'Delete this account?',
		deleteMessage: 'Delete {name}? There is no undo.',
		deleteConfirm: 'Delete account',

		// A deletion refused because something points at the record says what does, where the record is, and never in a modal
		deleteBlockedByTransactions: {
			one: '{name} cannot be deleted: 1 transaction points at it. Set a closing date if you just want to retire it.',
			other: '{name} cannot be deleted: {count} transactions point at it. Set a closing date if you just want to retire it.'
		},
		deleteBlockedByTrades: {
			one: '{name} cannot be deleted: 1 trade points at it. Set a closing date if you just want to retire it.',
			other: '{name} cannot be deleted: {count} trades point at it. Set a closing date if you just want to retire it.'
		},
		form: {
			addTitle: 'Add account',
			editTitle: 'Edit account',
			name: 'Name',
			namePlaceholder: 'e.g. Conto Corrente',
			institution: 'Institution',
			institutionNone: 'None',
			institutionChoose: 'Choose an institution',
			institutionOnlyCash: 'A Cash account is money held by nobody, so it has no institution.',
			type: 'Type',
			typeLocked: 'A cash account and a brokerage account cannot become one another. Delete this one and record it again to move it across.',
			openingBalance: 'Opening balance',
			openingBalanceBrokerage: 'A Brokerage account is worth its holdings, so it has no opening balance.',
			exitTax: 'Exit tax',
			exitTaxExplanation: 'The rate this fund’s payout would be taxed at. It moves the estimate of what the fund is worth and nothing that was ever recorded.',
			openingDate: 'Opening date',
			closingDate: 'Closing date',
			closingDateHint: 'Empty while the account is open. Filling it in is what retires an account.',
			closingBeforeOpening: 'The closing date cannot be before the opening date.',
			notes: 'Notes',
			nameTaken: 'Another account at this institution already uses this name.',
			nameTakenWithoutInstitution: 'Another account without an institution already uses this name.'
		}
	},

	// The Institutions tab of the Accounts screen. An institution groups accounts and carries a sell fee, and it is created,
	// edited and deleted here and nowhere else.
	institutions: {
		add: 'Add institution',
		table: 'Institutions',
		summary: {
			one: '1 institution',
			other: '{count} institutions'
		},
		footer: '{institutions} · {accounts}',
		accountCount: {
			one: '1 account',
			other: '{count} accounts'
		},
		columns: {
			name: 'Name',
			defaultSellFee: 'Default sell fee',
			accounts: 'Accounts',
			notes: 'Notes'
		},
		rowMenu: 'What can be done to {name}',
		deleteTitle: 'Delete this institution?',
		deleteMessage: 'Delete {name}? There is no undo.',
		deleteConfirm: 'Delete institution',
		deleteBlocked: {
			one: '{name} cannot be deleted while an account points at it: {accounts}.',
			other: '{name} cannot be deleted while {count} accounts point at it: {accounts}.'
		},
		form: {
			addTitle: 'Add institution',
			editTitle: 'Edit institution',
			name: 'Name',
			namePlaceholder: 'e.g. Banca Sella',
			defaultSellFee: 'Default sell fee',
			defaultSellFeeExplanation: 'The flat fee charged once per holding when estimating what a position would leave you with. It is required, so type a zero to see gross figures.',
			notes: 'Notes',
			nameTaken: 'An institution with this name is already recorded.'
		}
	},

	// The Transactions screen: the whole history in one order, seven filters over it, and every cell edited where it sits
	transactions: {
		add: 'Add transaction',
		bulkImport: 'Bulk import',
		table: 'Transactions',
		count: {
			one: '1 transaction',
			other: '{count} transactions'
		},
		summaryFiltered: '{shown} of {total} transactions',
		resultCount: {
			one: '1 result',
			other: '{count} results'
		},
		selectedCount: '{count} selected',
		footer: '{results} · {total}',
		footerWithSelection: '{results} · {selected} · {total}',
		columns: {
			date: 'Date',
			account: 'Account',
			description: 'Description',
			amount: 'Amount',
			category: 'Category',
			matched: 'Matched',
			receipt: 'Receipt',
			notes: 'Notes'
		},

		// The Matched column, which is derived and read-only. It names the counterpart of every kind of pairing there is: the
		// other account for a transfer, the security for a trade-matched row, the payslip for a salary or a pension credit.
		matched: {
			counterpart: '⇄ {name}',
			none: '—',
			noneLabel: 'Nothing is paired with this row'
		},

		noCategory: 'no category',
		noNotes: '—',
		select: 'Select {description}',
		selectAll: 'Select every transaction these filters match',
		rowMenu: 'What can be done to {description}',
		deleteTitle: 'Delete this transaction?',
		deleteMessage: 'Delete {description} of {amount}? There is no undo.',
		deleteConfirm: 'Delete transaction',
		bulkDelete: 'Delete {count} selected',
		bulkDeleteTitle: 'Delete these transactions?',
		bulkDeleteMessage: {
			one: 'Delete 1 transaction totalling {total}? There is no undo.',
			other: 'Delete {count} transactions totalling {total}? There is no undo.'
		},
		bulkDeleteConfirm: 'Delete transactions',

		filters: {
			account: 'Account',
			period: 'Period',
			from: 'From',
			to: 'To',
			category: 'Category',
			setBy: 'Set by',
			setByAnything: 'Anything',
			setByRule: 'A rule',
			setByHand: 'By hand',
			amount: 'Amount',
			amountFrom: 'Amount from',
			amountTo: 'Amount to',
			receipt: 'Receipt',
			receiptAny: 'Any',
			search: 'Search',
			searchPlaceholder: 'Search description…',
			accountAll: 'All'
		},
		form: {
			addTitle: 'Add transaction',
			editTitle: 'Edit transaction',
			account: 'Account',
			accountChoose: 'Choose an account',
			date: 'Date',
			description: 'Description',
			descriptionPlaceholder: 'e.g. RIMBORSO SPESE VIAGGIO',
			amount: 'Amount',
			amountHint: 'Signed: money out is negative, and zero is a legal amount.',
			category: 'Category',
			receipt: 'Receipt',
			notes: 'Notes',
			saveAndAddAnother: 'Save and add another'
		}
	},

	// Bulk import: one screen and one job, which is getting raw rows in without duplicating anything. Nothing about a paste is
	// inferred — the three controls say what its characters mean, and a row that does not fit them is a row that cannot be read.
	import: {
		cancel: 'Cancel',
		action: {
			one: 'Import 1 transaction',
			other: 'Import {count} transactions'
		},
		summary: '{pasted} · {selected}',
		summaryWithDuplicates: '{pasted} · {selected} · {duplicates}',
		summaryWithUnreadable: '{pasted} · {selected} · {unreadable}',
		summaryWithBoth: '{pasted} · {selected} · {duplicates} · {unreadable}',
		rowCount: {
			one: '1 row pasted',
			other: '{count} rows pasted'
		},
		selectedCount: '{count} selected',
		duplicateCount: {
			one: '1 duplicate',
			other: '{count} duplicates'
		},
		unreadableCount: {
			one: '1 unreadable',
			other: '{count} unreadable'
		},
		pasteTitle: 'Paste rows — tab separated',
		pasteLabel: 'Pasted rows',
		pastePlaceholder: 'Paste the three columns straight out of your bank’s export.',
		formatTitle: 'Read these rows as',
		dateFormat: 'Date format',
		decimalSeparator: 'Decimal separator',
		thousandsSeparator: 'Thousands separator',
		formatNote: 'These three start at your Settings values and apply to this paste only. Change one and every row is read again.',
		accountTitle: 'Import into',
		account: 'Account',
		accountChoose: 'Choose an account',
		accountNote: 'The account is chosen once for the whole paste, and only cash accounts are listed — a brokerage account holds no transactions to import.',
		outcomeTitle: 'Outcome',
		outcomePasted: 'Rows pasted',
		outcomeSelected: 'Selected for import',
		outcomeDuplicates: 'Already in the file',
		outcomeUnreadable: 'Cannot be read',
		columnsTitle: 'Expected column order',
		columnsNote: 'Every import uses this order, one row per line with the columns separated by tabs; rearrange the export before pasting if your bank produces something else. A fourth column and beyond is ignored.',
		previewTitle: 'Preview',
		previewEmpty: 'Nothing has been pasted yet. Rows appear here as they are pasted, read exactly as the controls say they should be.',
		table: 'Rows to import',
		columns: {
			date: 'Date',
			description: 'Description',
			amount: 'Amount',
			amountSigned: 'Amount — signed',
			status: 'Status'
		},
		select: 'Import the row pasted on line {line}',
		cannotSelect: 'The row pasted on line {line} cannot be read',
		statusNew: 'new',
		statusDuplicate: 'already imported',
		statusUnreadable: 'cannot be read — {reason}',

		// Why a row cannot be read, as the preview states it beside the row itself
		refusal: {
			columns: {
				one: '1 column, and three are needed',
				other: '{count} columns, and three are needed'
			},
			date: 'the date is not a real day written as {dateFormat}',
			futureDate: 'the date is in the future',
			amount: 'the amount cannot be read with these separators',
			description: 'the description is empty'
		},
		duplicateNotice: {
			one: '1 row is already in the file and has been unselected — tick it anyway if the duplicate is genuine.',
			other: '{count} rows are already in the file and have been unselected — tick one anyway if the duplicate is genuine.'
		},
		unreadableNotice: {
			one: '1 row cannot be read and cannot be ticked: correct it in the paste above, or import without it.',
			other: '{count} rows cannot be read and cannot be ticked: correct them in the paste above, or import without them.'
		}
	},

	// The three receipt states, written the same way wherever they are shown. The stored "na" is never one of them.
	receiptStates: {
		pending: 'Pending',
		checked: 'Checked',
		na: 'N/A'
	},

	// The category picker, and the entries that are not categories: one on a transaction, one on a filter, one on a rule
	categoryPicker: {
		automatic: 'Automatic (let rules decide)',
		uncategorised: 'Uncategorised',
		all: 'All',
		choose: 'Choose a category'
	},

	// The three tabs of the Categories screen: the report, the rules that fill it, and the list both are made of
	categoryTabs: {
		report: 'Report',
		rules: 'Rules',
		list: 'Category list'
	},

	// The six types a category can be, written the same way wherever one is shown
	categoryTypes: {
		income: 'Income',
		expense: 'Expense',
		investment: 'Investment',
		divestment: 'Divestment',
		internal: 'Internal',
		revaluation: 'Revaluation'
	},

	// The category list tab: read-only, alphabetical, and the only place the whole taxonomy is visible at once
	categoryList: {
		table: 'Categories',
		summary: {
			one: '1 category',
			other: '{count} categories'
		},
		footer: '{categories} · {transactions} categorised',
		tracked: 'Receipt tracked',
		columns: {
			name: 'Category',
			type: 'Type',
			receiptTracked: 'Receipt tracked',
			transactions: 'Transactions'
		}
	},

	// The report tab: the categories × years matrix, the one screen that answers where the money goes
	report: {
		table: 'Where the money goes, by category and year',
		range: '{from} – {to}',
		noYears: 'No year has anything in it yet',
		partialYear: {
			one: '1 month so far',
			other: '{count} months so far'
		},
		net: 'Net',
		openCell: 'Show the {category} transactions of {year}',
		openTotal: 'Show every {category} transaction in this table',
		columns: {
			category: 'Category',
			total: 'Total'
		},
		groups: {
			income: 'Income',
			expense: 'Expense',
			internal: 'Internal',
			investments: 'Investments'
		},
		subtotals: {
			income: 'Total income',
			expense: 'Total expense',
			internal: 'Total internal'
		},
		filters: {
			years: 'Years',
			account: 'Account',
			accountAll: 'All'
		},
		years: {
			'last-5': 'Last 5',
			all: 'All'
		}
	},

	// The rules tab: ordered, draggable, numbered, and edited as a session that writes nothing until it is applied
	rules: {
		add: 'Add rule',
		discard: 'Discard changes',
		table: 'Categorisation rules',
		count: {
			one: '1 rule',
			other: '{count} rules'
		},
		summary: {
			one: '1 rule · first match wins · case and accent insensitive',
			other: '{count} rules · first match wins · case and accent insensitive'
		},
		summaryPending: '{rules} · {pending}',
		pendingCount: {
			one: '1 unapplied change',
			other: '{count} unapplied changes'
		},
		footerApplied: '“Applies to” still counts the list as applied',
		footerPending: '{rules} after these edits · nothing written yet · {applied}',
		reorder: 'Reorder {rule}',
		rowMenu: 'What can be done to {rule}',
		columns: {
			order: 'Order',
			position: '#',
			substring: 'Matches description containing',
			category: 'Category',
			appliesTo: 'Applies to'
		},

		// What a rule is doing that the file does not know about yet
		marker: {
			added: 'added',
			edited: 'edited'
		},

		// What the drag says out loud, for whoever is moving a rule with the keyboard rather than with a pointer
		drag: {
			instructions: 'Press Space to pick a rule up, the arrow keys to move it, Space again to drop it and Escape to leave it where it was.',
			picked: 'Picked up {rule}. It is rule {position} of {of}.',
			over: 'Moving {rule} to position {position} of {of}.',
			dropped: 'Dropped {rule} at position {position} of {of}.',
			cancelled: 'Left {rule} where it was.'
		},
		form: {
			addTitle: 'Add rule',
			editTitle: 'Edit rule',
			substring: 'Matches description containing',
			substringPlaceholder: 'e.g. ESSELUNGA',
			substringHint: 'Matched anywhere in the description, ignoring case and accents.',
			category: 'Category'
		},

		// What applying the draft would do, as the four figures the confirmation states
		apply: {
			action: 'Apply changes',
			title: 'Apply these changes?',
			lead: {
				one: '1 edit in this session. Nothing has been written yet.',
				other: '{count} edits in this session. Nothing has been written yet.'
			},
			figures: 'What will happen to transactions',
			changed: 'Change category',
			lost: 'Lose their category',
			gained: 'Uncategorised → categorised',
			unchanged: 'Unchanged',
			unchangedOf: '{unchanged} of {total}',
			note: 'Hand-set categories are never touched.',
			confirm: 'Apply'
		}
	},

	// The four tabs of the Investments screen. Holdings is entirely derived from the middle two, and Securities is what all three point at.
	investmentTabs: {
		holdings: 'Holdings',
		purchases: 'Purchases · {count}',
		sales: 'Sales · {count}',
		securities: 'Securities · {count}'
	},

	// The four types a security can be, written the same way wherever one is shown
	securityTypes: {
		stock: 'Stock',
		'stock-etf': 'Stock ETF',
		'bond-etf': 'Bond ETF',
		etc: 'ETC'
	},

	// Where a security is listed. Eurozone only, every amount in the file being EUR.
	exchanges: {
		milan: 'Milan',
		xetra: 'XETRA',
		frankfurt: 'Frankfurt',
		amsterdam: 'Amsterdam',
		paris: 'Paris',
		brussels: 'Brussels',
		lisbon: 'Lisbon',
		madrid: 'Madrid',
		vienna: 'Vienna',
		helsinki: 'Helsinki',
		dublin: 'Dublin',
		athens: 'Athens',
		stuttgart: 'Stuttgart',
		dusseldorf: 'Düsseldorf',
		munich: 'Munich',
		hamburg: 'Hamburg',
		tallinn: 'Tallinn',
		vilnius: 'Vilnius'
	},

	// The Holdings tab: every figure derived, every column read-only except the price, and gross of tax and fees throughout
	holdings: {
		table: 'Holdings',
		summary: '{positions} · {accounts}',
		summaryStale: '{positions} · {accounts} · {stale}',
		positionCount: {
			one: '1 open position',
			other: '{count} open positions'
		},
		accountCount: {
			one: '1 brokerage account',
			other: '{count} brokerage accounts'
		},
		staleCount: {
			one: '1 stale',
			other: '{count} stale'
		},
		columns: {
			security: 'Security',
			type: 'Type',
			account: 'Where',
			value: 'Value',
			gain: 'Gain',
			annualisedReturn: 'Ann. return'
		},
		noPrice: 'none',
		gainWithPercentage: '{gain} · {percentage}',

		// What the columns with nothing to total read, the last row of the table stating every total under its own column
		total: 'Total',
		footerDerived: 'Everything in this table is computed from your purchases, your sales and your securities. Value and gain are gross of tax and fees.',
		footerReturnOmitted: {
			one: '1 position is left out of the annualised return whole: it is oversold, or its security has never been priced.',
			other: '{count} positions are left out of the annualised return whole: they are oversold, or their security has never been priced.'
		},
		select: 'Show the detail of {security}',

		// The detail panel: the facts about the position's history first, and what selling it today would produce after them
		detail: {
			held: 'Held',
			purchased: 'Purchased',
			purchasedLots: {
				one: 'Purchased, 1 lot',
				other: 'Purchased, {count} lots'
			},
			sold: 'Sold',
			avgCost: 'Weighted average cost',
			invested: 'Invested, incl. fees',

			// A price belongs to the security and not to this holding, which is why it is stated here and kept on Securities
			latestPrice: 'Latest price',
			lastPriced: 'Last priced',
			annualisedReturn: 'Annualised return',
			returnExplanation: 'What the money in this position has earned per year, counting when each purchase was made and not just how much went in. Before tax.',
			ifSoldToday: 'If sold today',
			grossProceeds: 'Gross proceeds',
			sellFee: 'Sell fee, {institution} default',
			taxableGain: 'Taxable gain',
			tax: 'Tax, {rate} — {security} rate',
			netProceeds: 'Net proceeds',
			netGain: 'Net gain',
			caveat: 'Average cost is an approximation, and your broker may match lots differently when it computes the taxable gain. Two things make the figure cautious rather than optimistic: the tax is worked out for this position alone, so a loss on another holding does not reduce it, and the sell fee is charged once per holding.'
		}
	},

	// The Purchases and Sales tabs: the same table, with three columns Sales has and Purchases does not
	trades: {
		addPurchase: 'Add purchase',
		addSale: 'Add sale',
		tablePurchases: 'Purchases',
		tableSales: 'Sales',
		purchaseCount: {
			one: '1 purchase',
			other: '{count} purchases'
		},
		saleCount: {
			one: '1 sale',
			other: '{count} sales'
		},
		securityCount: {
			one: '1 security',
			other: '{count} securities'
		},
		summaryFiltered: '{shown} of {trades}',
		shownCount: '{shown} of {total} shown',
		footerPurchases: '{purchases} · {securities} · fees {fees} · total cost {total}',
		footerSales: '{sales} · {securities} · fees {fees} · taxes {taxes} · net proceeds {total} · realised gain {gain}',
		footerSalesOmitted: {
			one: '{footer}, which leaves out 1 sale with no cost basis behind it',
			other: '{footer}, which leaves out {count} sales with no cost basis behind them'
		},
		columns: {
			date: 'Date',
			security: 'Security',
			account: 'Account',
			quantity: 'Qty',
			unitPrice: 'Unit price',
			fees: 'Fees',
			taxes: 'Taxes',
			totalCost: 'Total cost',
			netProceeds: 'Net proceeds',
			realisedGain: 'Realised gain',
			matched: 'Matched',
			notes: 'Notes'
		},

		// Matched shows the date of the bank transaction the trade was paired with. A dash is what checks 6 and 7 report.
		matched: {
			date: '⇄ {date}',
			none: '—',
			noneLabel: 'No bank transaction is paired with this trade'
		},
		noNotes: '—',
		rowMenu: 'What can be done to the {security} trade of {date}',
		deleteTitle: 'Delete this trade?',
		deleteMessage: 'Delete the {security} trade of {date} for {total}? There is no undo.',
		deleteConfirm: 'Delete trade',
		filters: {
			security: 'Security',
			securityAll: 'All',
			account: 'Account',
			accountAll: 'All',
			period: 'Period',
			from: 'From',
			to: 'To'
		},
		form: {
			addPurchaseTitle: 'Add purchase',
			addSaleTitle: 'Add sale',
			editPurchaseTitle: 'Edit purchase',
			editSaleTitle: 'Edit sale',
			date: 'Date',
			account: 'Account',
			accountChoose: 'Choose an account',
			security: 'Security',
			securityChoose: 'Choose a security',
			securitySearch: 'ISIN or ticker',
			securitySearchHint: 'Type an ISIN or a ticker. If no security matches, the fields to create one appear below and it is saved with the trade.',
			securityNotFound: '{text} — not found',
			newSecurity: 'New security',
			quantity: 'Quantity',
			unitPrice: 'Unit price',
			fees: 'Fees',
			taxes: 'Taxes',
			taxesHint: 'What the broker actually withheld, from the trade confirmation. Zero, not blank, when nothing was.',
			notes: 'Notes',
			totalCost: 'Total cost',
			netProceeds: 'Net proceeds',
			derived: 'Computed as you type, and never entered.',
			noBrokerageAccount: 'There is no brokerage account yet. Add one on Accounts, and this form will offer it.'
		}
	},

	// The Securities tab: where a security is created and corrected, and where its whole price history lives
	securities: {
		add: 'Add security',
		table: 'Securities',
		option: '{ticker} · {name}',
		summary: '{securities} · {held} held · {sold} fully sold',
		summaryPlain: '{securities}',
		count: {
			one: '1 security',
			other: '{count} securities'
		},
		footer: '{securities} · {sold} no longer held',
		columns: {
			ticker: 'Ticker',
			isin: 'ISIN',
			exchange: 'Exchange',
			type: 'Type',
			taxRate: 'Tax rate',
			held: 'Held',
			trades: 'Trades',
			prices: 'Prices',
			lastPriced: 'Last priced'
		},
		oversold: 'Oversold — no quantity can be stated',
		stalePrice: 'Stale — this security is held and its latest price is older than your staleness threshold',
		neverPriced: 'Never priced — this security is held and is carried at what it cost',
		select: 'Show the price history of {ticker}',
		rowMenu: 'What can be done to {ticker}',
		deleteTitle: 'Delete this security?',
		deleteMessage: {
			one: 'Delete {ticker}? Its 1 price record goes with it. There is no undo.',
			other: 'Delete {ticker}? Its {count} price records go with it. There is no undo.'
		},
		deleteMessageNoPrices: 'Delete {ticker}? There is no undo.',
		deleteConfirm: 'Delete security',
		deleteBlockedByTrades: {
			one: '{ticker} cannot be deleted: 1 trade points at it.',
			other: '{ticker} cannot be deleted: {count} trades point at it.'
		},
		form: {
			addTitle: 'Add security',
			editTitle: 'Edit security',
			isin: 'ISIN',
			isinPlaceholder: 'e.g. IE00B4L5Y983',
			isinTaken: 'A security with this ISIN is already recorded.',
			ticker: 'Ticker',
			tickerPlaceholder: 'e.g. SWDA',
			tickerHint: 'The code the exchange below lists this security under, not a label of your own: the two together are what a price lookup asks for.',
			exchange: 'Exchange',
			exchangeHint: 'Where this security is quoted. Getting it wrong costs nothing that is recorded — only a quote that does not arrive.',
			name: 'Name',
			namePlaceholder: 'e.g. iShares Core MSCI World',
			type: 'Type',
			taxRate: 'Tax rate',
			taxRateHint: 'Pre-filled from your default. A Bond ETF holding government paper is the one that is not the default, carrying a blend below the ordinary rate.',
			notes: 'Notes'
		}
	},

	// The price history of one security: the only table in the application that reads newest first, and the only place a price is deleted
	prices: {
		add: 'Add price',
		table: 'Price history',
		heading: {
			one: 'Price history — 1 record',
			other: 'Price history — {count} records'
		},
		empty: 'Nothing has been priced yet. Add a price, or record one on the Holdings tab.',
		footer: '{count} · {range}',
		range: '{from} – {to}',
		columns: {
			date: 'Date',
			value: 'Value',
			source: 'Source'
		},
		sources: {
			manual: 'manual',
			fetched: 'fetched'
		},
		rowMenu: 'What can be done to the price of {date}',
		deleteTitle: 'Delete this price?',
		deleteMessage: 'Delete the price of {date}, {value}? There is no undo.',
		deleteConfirm: 'Delete price',
		form: {
			addTitle: 'Add price',
			editTitle: 'Edit price',
			subtitle: '{ticker} — one price per day, and a second one for a day replaces it',
			date: 'As of',
			value: 'Value',
			replaces: 'This day already holds {value}, and saving replaces it.'
		}
	},

	// The modal the *Update prices* button opens: which securities, how far back, what came back, and what writing it would do
	updatePrices: {
		button: 'Update prices',
		title: 'Update prices',
		fetching: 'Fetching prices',
		fetched: 'Prices fetched',
		providerName: 'Yahoo Finance',
		steps: {
			choose: '1 Choose',
			fetch: '2 Fetch and review'
		},

		// Said on the page that sends, beside the listings it will send and the column of first days that goes with them
		whatLeaves: 'Fetching sends each ticked security’s ticker and exchange to {provider} — and, where more than the latest quote is asked for, the day in the Ask from column — and nothing else: never the ISIN, never an amount, a quantity or an account.',

		// How far back, which is one question with three answers and covers every ticked security
		spanLegend: 'How far back',
		spans: {
			latest: 'Latest quote only',
			latestNote: 'One figure per security, whatever day the provider has it for. This is what keeps an open file current.',
			sinceLast: 'Since the last price',
			sinceLastNote: 'From the day after each security’s most recent price. One with no price at all is asked from its first purchase.',
			wholeHistory: 'The whole history',
			wholeHistoryNote: 'From each security’s first purchase to today, or to its last sale where the position is closed. This is what fills a history in, and it asks for years of days at a time.'
		},

		select: 'Select',
		selectors: {
			all: 'All',
			none: 'None',
			held: 'Held',
			neverPriced: 'Never priced',
			stale: 'Stale',
			writable: 'All that can be written'
		},
		selectAll: 'Ask about every security',
		askAbout: 'Ask about {ticker}',
		tickAll: 'Write every security that can be written',
		write: 'Write the prices fetched for {ticker}',
		cannotWrite: 'Nothing to write for {ticker}',

		chooseTable: 'Securities to ask about',
		reviewTable: 'What came back',
		columns: {
			security: 'Security',
			lastPrice: 'Last price',
			pricedOn: 'Priced on',
			askFrom: 'Ask from',
			days: 'Days',
			quote: 'Newest quote',
			quoteDate: 'Quote is for',
			cameBack: 'What came back'
		},
		neverPriced: 'never priced',
		notHeld: 'no longer held',
		latestOnly: 'latest quote',
		securityCount: {
			one: '1 security',
			other: '{count} securities'
		},
		dayCount: {
			one: '1 day to ask for',
			other: '{count} days to ask for'
		},
		chooseFooter: '{securities} ticked · {days}',
		fetch: 'Fetch {securities}',
		fetchDays: 'Fetch {securities} · {days}',

		// How far the running pass has got, which a file asked day by day is slow enough to need
		progress: '{done} of {total} asked · {ticker}',
		progressAsked: '{done} of {total} asked',
		stillRunning: 'Nothing is written while the pass runs.',
		queued: 'queued',
		asking: 'asking…',
		notAsked: 'not asked for',

		// What one row says came back, which is what writing it would do to the file
		daysBack: {
			one: '1 day',
			other: '{count} days'
		},
		newDays: {
			one: '1 new',
			other: '{count} new'
		},
		replacedDays: {
			one: '1 replaces',
			other: '{count} replace'
		},
		unchangedDays: {
			one: '1 unchanged',
			other: '{count} unchanged'
		},
		droppedDays: {
			one: '1 dropped',
			other: '{count} dropped'
		},
		showReplacements: 'Show the days that change',
		hideReplacements: 'Hide the days that change',
		replacementsTitle: {
			one: 'The day that changes',
			other: 'The {count} days that change'
		},
		replacementNow: 'now {value} · {source}',

		referenceDate: 'Provider reference date {date}',
		reviewFooter: '{writes} over {securities} · {replaced} · {rest}',
		writeCount: {
			one: '1 price to write',
			other: '{count} prices to write'
		},
		replacedNone: 'every day is new',
		replaced: '{count} replace a different value, {manual}',
		replacedManual: {
			one: '1 of them typed by hand',
			other: '{count} of them typed by hand'
		},
		unchangedAndDropped: '{unchanged} · {dropped}',
		unchangedCount: {
			one: '1 day unchanged',
			other: '{count} days unchanged'
		},
		droppedCount: {
			one: '1 day dropped',
			other: '{count} days dropped'
		},

		changeOptions: '← Change options',
		retry: {
			one: 'Retry the 1 that failed',
			other: 'Retry the {count} that failed'
		},
		canRetry: 'can be retried',

		// Cancelling a running pass, which throws away what is already on screen
		stopTitle: 'Stop fetching?',
		stopMessage: 'The pass is not finished. Closing now discards the prices already fetched, including the ones you can see — nothing has been written, and every price the file holds still stands.',
		stopConfirm: 'Stop and close',
		stopCancel: 'Keep fetching',

		problems: 'Nothing to write for these — they keep the prices they have',
		reasons: {
			noQuote: 'the provider has no quote for it',
			futureDate: 'could not be fetched — the quote is dated in the future',
			notPositive: 'could not be fetched — the quote is zero or less',
			notEuro: 'could not be fetched — quoted in {currency}, not EUR',
			noCurrency: 'could not be fetched — the provider stated no currency',
			failed: 'could not be fetched — {message}'
		},
		passFailed: 'The price pass could not be started.',
		nothingToWrite: 'Nothing came back that can be written. Every price the file holds still stands, and fetching again is the remedy — as is typing a price in by hand.',
		confirm: {
			one: 'Write 1 price',
			other: 'Write {count} prices'
		},
		close: 'Close',
		wrote: {
			one: '1 price written.',
			other: '{count} prices written.'
		}
	},

	// The two tabs of the Salaries screen. Contracts is the denominator every figure on Payslips divides by, which is why they sit together.
	salaryTabs: {
		payslips: 'Payslips',
		contracts: 'Contracts · {count}'
	},

	// The Contracts tab. A contract is never retired, only ended: it stays in the selector and keeps its payslips and its years.
	contracts: {
		table: 'Contracts',
		add: 'Add contract',
		selector: 'Contract',
		select: 'Show the payslips of {name}',
		count: {
			one: '1 contract',
			other: '{count} contracts'
		},
		payslipCount: {
			one: '1 payslip',
			other: '{count} payslips'
		},
		yearCount: {
			one: '1 year',
			other: '{count} years'
		},
		range: '{from} – {to}',
		summary: '{contracts} · {payslips} · {range}',
		summaryWithoutPayslips: '{contracts} · {payslips}',
		footer: '{contracts} · {ended} · {payslips}',
		endedNone: 'none ended',
		ended: {
			one: '1 ended',
			other: '{count} ended'
		},

		// The terms the payslips of the selected contract are read against, stated under the heading
		terms: '{name} · {months} · {hours}',
		monthsPerYear: {
			one: '1 month per year',
			other: '{count} months per year'
		},
		hoursPerDay: '{hours} hours per day',
		columns: {
			name: 'Employer',
			monthsPerYear: 'Months / year',
			hoursPerDay: 'Hours / day',
			startDate: 'Start',
			endDate: 'End',
			payslips: 'Payslips',
			notes: 'Notes'
		},
		rowMenu: 'Actions for {name}',
		deleteTitle: 'Delete this contract?',
		deleteMessage: '{name} will be removed, and the working days recorded against its years with it. This cannot be undone.',
		deleteConfirm: 'Delete contract',
		deleteBlocked: {
			one: '{name} cannot be deleted while 1 payslip points at it. Delete it first.',
			other: '{name} cannot be deleted while {count} payslips point at it. Delete them first.'
		},
		form: {
			addTitle: 'Add contract',
			editTitle: 'Edit contract',
			name: 'Employer',
			namePlaceholder: 'e.g. Acme S.p.A.',
			nameTaken: 'There is already a contract with this employer.',
			monthsPerYear: 'Months per year',
			monthsPerYearHint: 'Thirteen where the year carries a tredicesima. The contract line on the totals chart is this times the monthly contract gross.',
			hoursPerDay: 'Hours per day',
			startDate: 'Start date',
			endDate: 'End date',
			endDateHint: 'Left empty while the contract is running. Ending a contract changes no figure: nothing in Spiccioli sums across contracts.',
			endBeforeStart: 'The end date cannot be before the start date.',

			// Narrowing is what is refused; widening is always fine, and is what an employer extending a contract looks like
			narrowedPastPayslips: {
				one: 'These dates would leave 1 payslip outside the contract: {months}. Delete it first, or leave the dates as they are.',
				other: 'These dates would leave {count} payslips outside the contract: {months}. Delete them first, or leave the dates as they are.'
			},
			narrowedPastYears: {
				one: 'These dates would leave the working days recorded for {years} outside the contract. Clear that year first, or leave the dates as they are.',
				other: 'These dates would leave the working days recorded for {years} outside the contract. Clear those years first, or leave the dates as they are.'
			},
			workingDaysHint: 'Working days belong to a year of a contract, and are entered from the per-year table on the Payslips tab.',
			notes: 'Notes'
		}
	},

	// The Payslips tab: the per-year table above, the payslips of the selected year below, and the two charts over every year of the contract
	payslips: {
		add: 'Add payslip',
		yearTable: 'Per year',
		table: 'Payslips of {year}',
		monthOfYear: '{month}/{year}',

		// How a payslip is named away from its own table: in the Matched column, and in everything checks 4 and 5 report
		periodWithLabel: '{month} · {label}',

		yearColumns: {
			year: 'Year',
			payslipCount: 'Payslips',
			yearContractGross: 'Annual contract gross',
			totalGross: 'Total gross',
			totalNetSalary: 'Total net salary',
			workingDays: 'Working days',
			grossPerHour: 'Gross / hour',
			netPerHour: 'Net / hour'
		},
		columns: {
			month: 'Month',
			label: 'Label',
			contractGross: 'Contract gross',
			gross: 'Gross',
			netPayment: 'Net payment',
			refunds: 'Refunds',
			carPayment: 'Car',
			netSalary: 'Net salary',
			employeeContribution: 'Employee',
			employerContribution: 'Employer',
			severanceContribution: 'TFR',
			notes: 'Notes'
		},

		// The one delete that is not confirmed: the record is the form, so saving it empty puts the year back where it was
		selectYear: 'Show the payslips of {year}',
		editWorkingDays: 'Edit the working days of {year}',
		workingDaysTitle: 'Working days',
		workingDaysSubtitle: 'the year {year} of this contract',
		workingDaysClears: 'Leave this empty and the year goes back to having no working days recorded, which is what it was before a number was entered.',
		workingDaysHint: 'Working days are always the whole calendar year, never the part worked — so a partial first or last year understates both hourly figures.',
		yearFooter: '{years} · {payslips} · {days}',
		workingDaysMissing: {
			one: '1 year without working days',
			other: '{count} years without working days'
		},
		workingDaysComplete: 'every year has its working days',
		footer: '{payslips} · gross {gross} · net payment {netPayment} · net salary {netSalary} · employee {employee} · employer {employer} · TFR {severance}',
		rowMenu: 'Actions for the payslip of {month}',
		deleteTitle: 'Delete this payslip?',
		deleteMessage: 'The payslip of {month} for {net} will be removed. This cannot be undone.',
		deleteConfirm: 'Delete payslip',

		// The two charts, side by side, covering every year of the contract
		charts: {
			averages: 'Average per month, per year',
			averageGross: 'average gross',
			averageNet: 'average net',
			totals: 'Totals per year',
			totalGross: 'gross',
			totalNet: 'net salary',
			contractLine: 'contract × months'
		},
		form: {
			addTitle: 'Add payslip',
			editTitle: 'Edit payslip',
			year: 'Year',
			yearHint: 'The contract’s own years, opening on the one the table below is showing. Saving into another year moves the table to it.',
			month: 'Month',
			monthOutsideContract: 'The contract does not cover {month}.',
			label: 'Label',
			labelPlaceholder: 'e.g. 13th',
			contractGross: 'Contract gross',
			gross: 'Gross',
			grossHint: 'The payslip’s own totale lordo line, typed as printed.',
			netPayment: 'Net payment',
			netPaymentHint: 'What reached the bank. It may be negative — a December whose tax recalculation exceeded the month’s net is a real payslip.',
			refunds: 'Refunds',
			carPayment: 'Car',
			employeeContribution: 'Employee',
			employerContribution: 'Employer',
			severanceContribution: 'TFR',
			pensionHint: 'The three credits that reach the pension fund separately. Zero is the ordinary value for a heading the payslip has nothing under.',
			netSalary: 'Net salary',
			netSalaryHint: 'Derived, never entered: net payment − refunds + car.',
			notes: 'Notes'
		}
	},

	// What is said when something on screen has not been written and the user is leaving anyway. There is no *apply* here.
	unsavedDraft: {
		title: 'These changes have not been applied',
		message: 'The rule list has been edited and nothing has been written. Leaving now throws those edits away.',
		discard: 'Discard changes',
		stay: 'Stay'
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

	// What a form and a table say wherever they appear, since neither wording belongs to one screen
	form: {
		save: 'Save',
		optional: 'optional'
	},

	// What a chart says for itself, wherever it is drawn
	chart: {
		// The value axis writes an amount at the coarsest scale it is short at, so that a tick is one line and never wraps
		axisThousands: 'k',
		axisMillions: 'M'
	},

	table: {
		// A column a record's type cannot carry: a field that cannot be filled rather than one nobody got round to
		notApplicable: '—',

		// A figure that cannot be evaluated. It is never zero and never blank, and whatever would make it computable is named by a check.
		undefined: 'undefined'
	},

	// What a paged table's pager says, wherever one is: the transactions list and a security's price history. The four steps are
	// drawn as glyphs and are named here rather than lettered, the name being what the keyboard and a reading get; how long a page
	// is is said by none of them.
	pager: {
		label: 'Pages',
		of: 'of {pages}',
		goTo: 'Go to page',
		first: 'First page',
		previous: 'Previous page',
		next: 'Next page',
		last: 'Last page'
	},

	// A line a screen puts above its list to say what it would not do. It is never a modal and it never blocks.
	notice: {
		dismiss: 'Dismiss'
	},

	rowMenu: {
		nothingToDo: 'Nothing to do here',
		edit: 'Edit',
		duplicate: 'Duplicate',
		delete: 'Delete'
	},

	dialog: {
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

	// The Checks screen: fourteen checks in the order of the specification's table, each stating what it examined and, where it
	// failed, naming at most five of the records it found. Nothing here is a warning: a check passes or it fails.
	checks: {
		summary: '{total} checks · {passing} passing · {failing} failing',
		allPassing: '{total} checks · all passing',
		passed: 'Passed',
		failed: 'Failed',
		showingSome: {
			one: 'showing {shown} of {count}',
			other: 'showing {shown} of {count}'
		},
		showingAll: {
			one: '{count} record',
			other: '{count} records'
		},

		// What each of the fourteen is called, and the one line under it saying what it looks for
		items: {
			transfersBalance: {
				name: 'Internal transfers balance out',
				description: 'Every internal transfer should appear in two accounts, with opposite signs.'
			},
			transactionsCategorised: {
				name: 'Every transaction has a category',
				description: 'A transaction carrying no category at all.'
			},
			pricesRecent: {
				name: 'Prices are recent',
				description: 'Every security with an open holding has a price, no older than the staleness threshold.'
			},
			payslipsMatchSalaries: {
				name: 'Payslips match salary transactions',
				description: 'Net payment on each payslip against a Salary transaction in the same month or the next.'
			},
			pensionContributionsMatch: {
				name: 'Payslip pension contributions match transactions',
				description: 'Employee share, employer share and TFR, each against its own credit, same window.'
			},
			purchasesMatch: {
				name: 'Purchase transactions match purchases',
				description: 'Securities purchase transactions against the purchases on the Investments screen.'
			},
			salesMatch: {
				name: 'Sale transactions match sales',
				description: 'Securities sale transactions against the sales on the Investments screen.'
			},
			noNegativeHolding: {
				name: 'No holding has gone negative',
				description: 'The running quantity of a security in an account never drops below zero.'
			},
			noSaleBeforePurchase: {
				name: 'No sale precedes its purchase',
				description: 'A sale with nothing bought on or before its date in the same account.'
			},
			pensionFundRevalued: {
				name: 'Pension fund revalued recently',
				description: 'Every open pension fund account carries a recent value adjustment.'
			},
			closedAccountsEmpty: {
				name: 'Closed accounts are empty',
				description: 'An account with a closing date has a balance of zero and no holdings left in it.'
			},
			recordsWithinAccountLife: {
				name: 'Records fall within their account’s life',
				description: 'No transaction or trade is dated before its account opened or after it closed.'
			},
			receiptTrackedHaveState: {
				name: 'Receipt-tracked transactions carry a state',
				description: 'A category that expects a receipt should never read N/A.'
			},
			noOverduePendingReceipt: {
				name: 'No receipt has been pending too long',
				description: 'No transaction marked pending is older than the pending threshold.'
			}
		},

		// What a check examined, stated whether it passed or failed, so that one that passed on nothing is distinguishable
		reach: {
			transferLegs: {
				one: '{count} transfer leg',
				other: '{count} transfer legs'
			},
			transactions: {
				one: '{count} transaction',
				other: '{count} transactions'
			},
			securitiesHeld: {
				one: '{count} security held',
				other: '{count} securities held'
			},
			payslips: {
				one: '{count} payslip',
				other: '{count} payslips'
			},
			contributions: {
				one: '{count} contribution',
				other: '{count} contributions'
			},
			purchases: {
				one: '{count} purchase',
				other: '{count} purchases'
			},
			sales: {
				one: '{count} sale',
				other: '{count} sales'
			},
			positions: {
				one: '{count} position',
				other: '{count} positions'
			},
			pensionFunds: {
				one: '{count} pension fund',
				other: '{count} pension funds'
			},
			closedAccounts: {
				one: '{count} closed account',
				other: '{count} closed accounts'
			},
			recordsAndTrades: '{transactions} transactions · {trades} trades',
			trackedTransactions: {
				one: '{count} tracked transaction',
				other: '{count} tracked transactions'
			},
			pendingReceipts: {
				one: '{count} pending receipt',
				other: '{count} pending receipts'
			}
		},

		// What the two lists of a check with two sides are called
		sides: {
			payslips: 'Unmatched payslips',
			contributions: 'Unmatched contributions',
			transactions: 'Unmatched transactions',
			purchases: 'Unmatched purchases',
			sales: 'Unmatched sales'
		},

		// Which of a payslip's three pension figures an entry is about
		pensionFigures: {
			employee: 'Employee share',
			employer: 'Employer share',
			severance: 'TFR'
		},

		// One record, written the way the screen it lives on writes it
		entries: {
			transaction: '{date} · {account} · {description} · {amount}',
			trade: '{date} · {ticker} · {account} · {total}',
			payslip: '{month} · {contract} · {amount}',
			pensionFigure: '{month} · {contract} · {figure} · {amount}',
			stalePrice: {
				one: '{ticker} · {name} · {price} on {date} — {count} day ago',
				other: '{ticker} · {name} · {price} on {date} — {count} days ago'
			},
			noPrice: '{ticker} · {name} — no price recorded',
			oversold: '{ticker} · {account} · {date} — sold {quantity} more than was held',
			neverRevalued: '{account} — never revalued',
			lastRevalued: '{account} — last revalued {date}',
			closedAccountBalance: '{account} · closed {date} — {balance} left in it',
			closedAccountHolding: '{account} · closed {date} — {quantity} still held',
			transactionRecord: '{date} · {description}',
			tradeRecord: '{date} · {ticker}',
			beforeOpening: '{record} · {account} — the account opened on {boundary}',
			afterClosing: '{record} · {account} — the account closed on {boundary}',
			overdueReceipt: {
				one: '{date} · {account} · {description} · {amount} — pending {count} day',
				other: '{date} · {account} · {description} · {amount} — pending {count} days'
			}
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
