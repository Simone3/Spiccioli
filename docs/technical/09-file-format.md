# §9 — The ledger file format

*[Index](README.md) · [← §8 Decisions](08-decisions.md)*

The format of a `.spiccioli` file, documented well enough for a script to write one the application opens. That is what this page exists for: [§12](../functional/specs/12-storage.md) requires it, because ten years of history are loaded by a one-off migration script rather than by the application.

**Read [§8.1](08-decisions.md#81-the-fourteen-decisions) first if you want to know *why* the format is this.** This page says what it is.

**It is checked rather than trusted.** `scripts/write-sample-ledger.js` writes a `.spiccioli` file from these tables alone, importing nothing from `src`, and `tests/logic/FileFormat.test.ts` hands its bytes and the worked example of [§9.6](#96-a-worked-example) to the application's own reader — so a field this page leaves out, or a scale it states wrongly, fails the suite rather than the person who trusted it. See [§9.8](#98-writing-one-from-a-script).

---

## 9.1 The shape

- **One file, one JSON document**, UTF-8, read whole and written whole. There is no second file, no sidecar and no index.
- **The extension is `.spiccioli`.** The backup folder beside it takes the file's name without that extension, plus `-backups` ([§12](../functional/specs/12-storage.md)).
- **The top level is an object with exactly twelve keys**: `schemaVersion` and one array per stored entity. `schemaVersion` is written first.
- **The application writes it indented with tabs and ends it with a newline.** A script need not: any JSON the reader accepts is a file the application opens, and the next save rewrites it in the application's own layout.

```
{
	"schemaVersion": 1,
	"institutions":  [ … ],
	"accounts":      [ … ],
	"securities":    [ … ],
	"prices":        [ … ],
	"transactions":  [ … ],
	"trades":        [ … ],
	"contracts":     [ … ],
	"contractYears": [ … ],
	"payslips":      [ … ],
	"categories":    [ … ],
	"rules":         [ … ]
}
```

**Order inside an array is not meaningful.** Every ordering the screens use is derived — by date, by name, by `order`, by `insertionSeq` — so a script may write records in whatever order it finds them.

## 9.2 The three rules that run through every record

**Every key is present, and a value that is not there is `null`.** The reader refuses a missing key exactly as it refuses an unknown one. There is no such thing as an optional key: `notes` on a record with no notes is `""`, and `closingDate` on an open account is `null`.

**Every number is an integer, in the minor units its field fixes.** A figure carrying a fraction is refused rather than rounded — a fraction of a cent is a file this application did not write. The scales:

| Kind | Fields | Stored as |
| --- | --- | --- |
| `amount` | every monetary field | **cents**, two decimal places. `€ 42,50` is `4250` |
| `decimal(6)` | `quantity` | **millionths**, six decimal places. `12,5` units is `12500000` |
| `decimal(4)` | `unitPrice`, a Price's `value` | **ten-thousandths**, four decimal places. `€ 104,31` is `1043100` |
| `fraction` | `taxRate`, `exitTaxRate` | **ten-thousandths**. 26% is `2600`, 12,5% is `1250` |
| `decimal(2)` | `hoursPerDay` | **hundredths**. 8 hours is `800` |
| `int` | `workingDays`, `monthsPerYear`, `order`, `insertionSeq`, `year`, `month`, `schemaVersion` | as they are |

**Every date is a day, written `YYYY-MM-DD`.** There is no time and no time zone anywhere in the file. A date that is not a real calendar day — a 31st of February — is refused rather than rolled forward.

Two more things hold everywhere. **An `id` is any non-empty string** and is never shown to the user; the application generates a UUID, and a script may use whatever it likes as long as it is unique within its entity. **Text is stored as it is meant to be read**: the application trims on save, and a script is expected to have trimmed already.

## 9.3 The entities

Every field of every entity, in the order the application writes them. `→` marks a reference to another record's `id`; **the file may not hold a reference to a record it does not contain**.

### `institutions`

| Key | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `name` | string | |
| `defaultSellFee` | integer, cents | Flat, ≥ 0 |
| `notes` | string | `""` when there are none |

### `accounts`

| Key | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `name` | string | |
| `institutionId` | string → `institutions` · null | **`null` only on a `cash` account** |
| `type` | enum | `current-account` · `cash` · `brokerage-cash` · `deposit-account` · `term-deposit` · `pension-fund` · `voucher` · `brokerage` |
| `openingBalance` | integer, cents | Signed. Always `0` on `brokerage` |
| `exitTaxRate` | integer, ten-thousandths · null | **Only on `pension-fund`**; `null` on every other type |
| `openingDate` | date | |
| `closingDate` | date · null | `null` means open |
| `notes` | string | |

### `securities`

| Key | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `isin` | string | Unique. Twelve characters: two letters, nine alphanumerics, a digit |
| `ticker` | string | The code the security's `exchange` lists it under |
| `exchange` | enum | `milan` · `xetra` · `frankfurt` · `amsterdam` · `paris` · `brussels` · `lisbon` · `madrid` · `vienna` · `helsinki` · `dublin` · `athens` · `stuttgart` · `dusseldorf` · `munich` · `hamburg` · `tallinn` · `vilnius` |
| `name` | string | |
| `type` | enum | `stock` · `stock-etf` · `bond-etf` · `etc` |
| `taxRate` | integer, ten-thousandths | |
| `notes` | string | |

### `prices`

**Keyed by `securityId` + `date`**, not by an id. One price per security per day; two records for one pair are refused.

| Key | Type | Notes |
| --- | --- | --- |
| `securityId` | string → `securities` | |
| `date` | date | |
| `value` | integer, ten-thousandths | Positive |
| `source` | enum | `manual` · `fetched` |

### `transactions`

| Key | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `accountId` | string → `accounts` | Never a `brokerage` account |
| `date` | date | |
| `description` | string | As exported by the bank |
| `amount` | integer, cents | Signed. Negative is money out |
| `categoryId` | string → `categories` · null | `null` is legal: a row no rule matched |
| `categorySource` | enum | `automatic` · `manual` |
| `receiptState` | enum | `pending` · `checked` · `na` |
| `notes` | string | |
| `insertionSeq` | integer | Monotonic **among transactions**, never reused |

**A script writing `automatic` rows takes on the invariant of [§2](../functional/specs/02-domain-model.md)**: an `automatic` row's `categoryId` must be what the file's own rule list would produce — first match wins, matched case- and accent-insensitively against `description` alone. Writing `manual` instead is the way out: a `manual` category is one no automatic pass may touch.

### `trades`

| Key | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `kind` | enum | `purchase` · `sale` |
| `securityId` | string → `securities` | |
| `accountId` | string → `accounts` | Always a `brokerage` account |
| `date` | date | |
| `quantity` | integer, millionths | Always positive; `kind` carries the direction |
| `unitPrice` | integer, ten-thousandths | |
| `fees` | integer, cents | Actually charged |
| `taxes` | integer, cents | Withheld on a sale; always `0` on a purchase |
| `notes` | string | |
| `insertionSeq` | integer | Monotonic **among trades**, counted separately from transactions |

### `contracts`

| Key | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `name` | string | Employer |
| `monthsPerYear` | integer | 13 in the usual Italian contract |
| `hoursPerDay` | integer, hundredths | 8 hours is `800` |
| `startDate` | date | |
| `endDate` | date · null | |
| `notes` | string | |

### `contractYears`

**Keyed by `contractId` + `year`.** The record exists only for a year whose working days were entered.

| Key | Type | Notes |
| --- | --- | --- |
| `contractId` | string → `contracts` | |
| `year` | integer | |
| `workingDays` | integer | 1 – 366, for the **whole calendar year** |

### `payslips`

| Key | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `contractId` | string → `contracts` | |
| `year`, `month` | integer, integer | The month the pay is **for**. Not unique: a month may hold more than one payslip |
| `label` | string · null | “13th” for the tredicesima |
| `contractGross` | integer, cents | |
| `gross` | integer, cents | The payslip's own *totale lordo* line, copied as printed |
| `netPayment` | integer, cents | **Either sign** |
| `refunds` | integer, cents | Magnitude, ≥ 0 |
| `carPayment` | integer, cents | Magnitude, ≥ 0 |
| `employeeContribution` | integer, cents | Magnitude, ≥ 0. `0` where the payslip has nothing under that heading |
| `employerContribution` | integer, cents | The same |
| `severanceContribution` | integer, cents | The same |
| `notes` | string | |

### `categories`

**Seeded by the application and not editable at runtime.** The ids are fixed in code, and a file holding an id this version does not seed is refused. The twenty-seven, with the values the seed writes, are in [§6.3](../functional/specs/06-categories.md#63-category-list) — read down its `Order` column and the ids below are its rows in the same order.

`salary` · `pension-fund-contribution` · `reimbursement` · `gift-received` · `other-income` · `interest-dividends-and-bonuses` · `voucher-top-up` · `restaurants-and-bars` · `groceries` · `travel` · `home-and-household` · `rent-and-condominium-fees` · `electricity` · `home-internet` · `mobile-and-phone` · `entertainment` · `other-expense` · `bank-fees` · `income-and-other-taxes` · `wealth-tax` · `culture-and-education` · `health-and-personal-care` · `technology-and-devices` · `internal-transfer` · `securities-purchase` · `securities-sale` · `value-adjustment`

| Key | Type | Notes |
| --- | --- | --- |
| `id` | string | One of the twenty-seven above |
| `name` | string | Wording. The application seeds it from its own translation bundle |
| `type` | enum | `income` · `expense` · `investment` · `divestment` · `internal` · `revaluation` |
| `role` | enum · null | `salary` · `pension-contribution` · `securities-purchase` · `securities-sale` · `internal-transfer` · `value-adjustment` · `bank-fees` · `wealth-tax` · `interest-and-dividends`. **`null` on most categories** |
| `receiptTracked` | boolean | |
| `order` | integer | The report's row order, 1 – 27 |

**A script writing a file from scratch writes all twenty-seven**, with the `type`, `role`, `receiptTracked` and `order` of [§6.3](../functional/specs/06-categories.md#63-category-list). Leaving one out is legal only if nothing points at it, and the next new file the application creates would have it.

### `rules`

| Key | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `order` | integer | First match wins |
| `substring` | string | At least two characters. Matched case- and accent-insensitively against `description` |
| `categoryId` | string → `categories` | Required — a rule always points at a category |

## 9.4 The schema version

**`schemaVersion` is an integer, and it goes up by one every time the shape above changes.** It is the first key of the document. A file is at exactly one of three positions relative to the application reading it:

| | What happens |
| --- | --- |
| **The same version** | It is validated and opened |
| **An earlier version** | The upgrade of [§12.1](../functional/specs/12-storage.md#121-the-launch-screen) is offered: a copy of the file as it stands is written to the backup folder first, and cancelling writes nothing at all |
| **A later version** | It is **refused**. This build cannot know what was added after it |

**This build writes and reads schema version 1**, and no upgrade step exists yet because no earlier version does.

## 9.5 What makes a file *not understood*

Anything on this list is refused with a statement of what was not understood, and the file is not opened. **There is no read-only mode and nothing is ever ignored.**

**The statement says where, what, and which value.** It names the entity, the record's own id — the pair for the two entities keyed by one — the position counted in records of that entity rather than in lines of the file, the field, and the value the file held there, so that the record can be found by searching for it: *In the 2.857th transaction, id “t-2857”, “date” is not a day written as YYYY-MM-DD. The value found is “2026-13-05”.* The position is written with the separators of [§10](../functional/specs/10-settings.md), like every other figure on screen. **The value is the one part that is never written to the log** ([§8.4](08-decisions.md#84-what-d14-logs)) — on a figure it is an amount and on a text it is a description — so the main process is sent `redactLedgerRefusal` of the refusal and never the refusal itself.

| | Refused because |
| --- | --- |
| Bytes that are not JSON | |
| A `schemaVersion` later than this build's | See [§9.4](#94-the-schema-version) |
| A key the document or a record does not have | An unrecognised key is a shape this version has never heard of |
| A key a record is missing | A value that is not there is written as `null`, so an absent key is the same unknown shape |
| A value of the wrong kind | A number written as a string is not a number |
| A value outside a closed set | Every enum above is closed |
| A `role` outside the nine | |
| A category id this version does not seed | |
| A figure that is not an integer | A fraction of a cent is not something the application wrote |
| A date that is not a real day written `YYYY-MM-DD` | |
| Two records sharing an id, or two prices for one security and day, or two contract years for one contract and year | Whichever of them a reference meant, the file does not say |
| A reference to a record the file does not hold | |

**The rules the forms enforce are not re-applied on open.** Two different questions are asked at two different moments: *is this a file the application understands?* is this list, and *is this a value a person could have typed?* is [§13](../functional/specs/13-validation.md) and is asked at the point of entry. A file may therefore be perfectly readable and hold a payslip with a gross of zero — the application shows it faithfully and the checks complain about it. A script is free to write such a file, and should not expect the application to fix it.

## 9.6 A worked example

Small enough to read and complete enough to open. Three of the twenty-seven categories are shown; a real file carries all of them.

```json
{
	"schemaVersion": 1,
	"institutions": [
		{
			"id": "e2b1c0a4-1111-4a00-8000-000000000001",
			"name": "Fineco",
			"defaultSellFee": 295,
			"notes": ""
		}
	],
	"accounts": [
		{
			"id": "e2b1c0a4-2222-4a00-8000-000000000001",
			"name": "Conto Corrente",
			"institutionId": "e2b1c0a4-1111-4a00-8000-000000000001",
			"type": "current-account",
			"openingBalance": 250000,
			"exitTaxRate": null,
			"openingDate": "2016-03-01",
			"closingDate": null,
			"notes": ""
		},
		{
			"id": "e2b1c0a4-2222-4a00-8000-000000000002",
			"name": "Titoli",
			"institutionId": "e2b1c0a4-1111-4a00-8000-000000000001",
			"type": "brokerage",
			"openingBalance": 0,
			"exitTaxRate": null,
			"openingDate": "2019-06-14",
			"closingDate": null,
			"notes": ""
		}
	],
	"securities": [
		{
			"id": "e2b1c0a4-3333-4a00-8000-000000000001",
			"isin": "IE00B4L5Y983",
			"ticker": "SWDA",
			"exchange": "milan",
			"name": "iShares Core MSCI World",
			"type": "stock-etf",
			"taxRate": 2600,
			"notes": ""
		}
	],
	"prices": [
		{
			"securityId": "e2b1c0a4-3333-4a00-8000-000000000001",
			"date": "2026-08-07",
			"value": 1054300,
			"source": "fetched"
		}
	],
	"transactions": [
		{
			"id": "e2b1c0a4-4444-4a00-8000-000000000001",
			"accountId": "e2b1c0a4-2222-4a00-8000-000000000001",
			"date": "2026-08-06",
			"description": "ESSELUNGA MILANO VIA X",
			"amount": -4250,
			"categoryId": "groceries",
			"categorySource": "automatic",
			"receiptState": "na",
			"notes": "",
			"insertionSeq": 1
		}
	],
	"trades": [
		{
			"id": "e2b1c0a4-5555-4a00-8000-000000000001",
			"kind": "purchase",
			"securityId": "e2b1c0a4-3333-4a00-8000-000000000001",
			"accountId": "e2b1c0a4-2222-4a00-8000-000000000002",
			"date": "2026-08-05",
			"quantity": 12500000,
			"unitPrice": 1043100,
			"fees": 295,
			"taxes": 0,
			"notes": "",
			"insertionSeq": 1
		}
	],
	"contracts": [],
	"contractYears": [],
	"payslips": [],
	"categories": [
		{
			"id": "salary",
			"name": "Salary",
			"type": "income",
			"role": "salary",
			"receiptTracked": true,
			"order": 1
		},
		{
			"id": "groceries",
			"name": "Groceries",
			"type": "expense",
			"role": null,
			"receiptTracked": false,
			"order": 9
		},
		{
			"id": "internal-transfer",
			"name": "Internal transfer",
			"type": "internal",
			"role": "internal-transfer",
			"receiptTracked": false,
			"order": 24
		}
	],
	"rules": [
		{
			"id": "e2b1c0a4-6666-4a00-8000-000000000001",
			"order": 1,
			"substring": "ESSELUNGA",
			"categoryId": "groceries"
		}
	]
}
```

Reading the figures back: the current account opened with **€ 2.500,00**, the transaction is **−€ 42,50**, the trade bought **12,5** units at **€ 104,31** with **€ 2,95** of fees, the security is taxed at **26%**, and the price on 7 August is **€ 105,43**.

## 9.7 Where the code is

| | |
| --- | --- |
| The types | `src/types/LedgerTypes.ts` — the eleven entities and every closed set above |
| The reader | `src/logic/ledger/LedgerReader.ts`, over the field helpers of `LedgerFields.ts`. [§9.5](#95-what-makes-a-file-not-understood) is its refusal list, in `LedgerRefusal.ts` |
| The writer | `src/logic/ledger/LedgerWriter.ts` — the key order above is its key order |
| The seed | `src/logic/ledger/SeededCategories.ts` — the twenty-seven ids, with the names taken from the translation bundle |
| The version and the upgrade | `src/logic/ledger/LedgerDocument.ts` and `LedgerUpgrade.ts` |

All of it is pure: bytes in, model out, and nothing about a filesystem in any of it. Where the bytes come from is [§1](01-architecture.md)'s.

## 9.8 Writing one from a script

```sh
npm run write-sample-ledger            # writes dist/sample-ledger.spiccioli
npm run write-sample-ledger -- /tmp/x.spiccioli
```

`scripts/write-sample-ledger.js` is the worked example of [§9.6](#96-a-worked-example) at full size: every one of the eleven entities populated, all twenty-seven categories, a pension fund with its exit tax, a transaction no rule claims, a sale with the tax the broker withheld. **It imports nothing from `src`** — it was written by reading the tables above, which is the position whoever writes the migration script is in — so what it proves is that those tables are enough.

`tests/logic/FileFormat.test.ts` is what keeps it proving it: it runs the script, reads the file it wrote through `readLedgerDocument`, writes the result back out through `writeLedgerDocument` and reads it again, and checks that the automatic rows honour the invariant of [§9.3](#93-the-entities). It puts the worked example above through the same reader, and it holds the category list of [§9.3](#93-the-entities) to the ids the code actually seeds.

**Start a migration script by copying it.** What it does not do is decide anything: it writes made-up figures, and the shape is the whole of what is worth taking.

---

[← §8 Decisions](08-decisions.md)
