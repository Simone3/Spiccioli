
# current



TEST BASIC IMPORT + review




Let's now create some real templates to replace our sample one.
Some of these are weird so we'll probably need to refactor something in our core import logic.
I'll list them and give the logic I currently use to manually import the data.
I'm also uploading a sample anonymized file for each.

- Isybank Excel
	- date -> "Data"
	- description -> "Operazione" + "Dettagli" (concatenated with hyphen, one of the two may be empty)
	- amount -> "Importo"
- Trade Republic CSV
	- date -> "date"
	- description -> "description"
	- amount -> "amount"
- Edenred Excel
	- date -> "Data e ora"
	- description -> "Dettaglio"
	- amount -> "N. e importo buoni" (value: quantity and single-voucher price multiplied), with sign based on the description ("Utilizzo" means negative, "Ricarica" or "Ordine tessera" or "Ordine Cloud" means positive);
- Directa Excel
	- date -> "Data operazione"
	- description -> "Tipo operazione" + "Ticker" + "Isin" + "Descrizione" (concatenated with hyphen, some of them may be empty)
	- amount -> "Importo euro"
- ING Excel
	- date -> "DATA VALUTA"
	- description -> "DESCRIZIONE OPERAZIONE"
	- amount -> "IMPORTO IN EURO"






add transactions via file upload
	auto detect template and then fallback to generic if none match? way to force template? or just select template after click on "upload" button (multiple templates per bank possible too)
	upload and then put them in the bulk import standard form


add payslips via pdf upload (and save PDF as attachment too?)

add investments via pdf upload







# maybe in the future

## cross

debts, e.g. a Liability account type (mortgage, loan, card balance)

multi-currency

export to CSV/Excel/PDF

registering .spiccioli with the OS, so double-clicking a ledger opens it

password or encryption on the file

backup browser: list the rotated copies, preview one, restore it

a second backup location (an external drive, a synced folder)

undo / redo

sortable columns

keyboard shortcuts

command palette / global search across accounts, transactions, securities and payslips

## portfolio

inflation / real-terms figures

a projection of net worth from current savings rate

configurable Portfolio — choose and arrange the cards

net worth goals or milestones
over time graph: show to lines/areas for cash and investments? cash on the bottom and investments piled on top of them? -> explored the idea but the UI would not be that great

## transactions

wider import tolerance — trailing-sign and parenthesised negatives, debit/credit column pairs, D/C markers, header rows, quoted fields, BOMs, month-name and two-digit-year dates

## categories

editing the category list at runtime — add, rename, delete

category groups

monthly reports instead of yearly only

budgets: a planned figure per category per year, against actuals

year-over-year comparison on the report

a per-category trend line across years

a monthly cash-flow chart

## deposits

interest accrued but not yet credited on term deposits

term-deposit maturity dates, with reminders

## vouchers

voucher expiry tracking

## pension funds

splitting a pension fund's opening balance into contributions and revaluation

a pension fund that credits its three contributions as one payment

per-fund contribution cadence, with an effective date, instead of one setting for the whole installation

deriving the pension exit rate from years of participation instead of a typed number

## salaries

TFR left with the employer -> interesting to see what i have there!

actual pension contributions

bulk import of payslips

a pension in place of a salary

payslip PDF attachment

## investments

individual bonds

extra operations on investments
	corporate actions (split/merger/ISIN-change adjustment records)
	transferring a position between brokers
	merging two securities (e.g. for the mistyped-ISIN case)

opening position on a holding

taxes
	loss offsetting in the liquidation estimate, across holdings rather than one at a time
	carried-forward capital losses, with a warning before the four-year expiry

percentage, tiered, or per-order sell fees instead of flat-per-holding

the gross-of-expenses rule on ETF gains

non-EUR quotes for investments converted rather than refused

a time-weighted return alongside the money-weighted one

attributing dividends and coupons to the holding that produced them, giving total return instead of price-only

bulk import of trades

marking a same-day round trip

FIFO cost basis as an option alongside weighted average

a watchlist of securities not yet held

benchmark comparison — the portfolio's line against an index

## checks

narrowing a check — a scope, an accepted failure, or a cut-off date

turning a check off

wealth-tax (imposta di bollo) check: does the amount charged match the balance it was levied on


