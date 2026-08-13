# §8 — Salaries

*[Index](../README.md) · [mockups for this section](../mockups/08-salaries.html)*

Two tabs: Payslips, Contracts. Scoped to one contract, then to one year.

---

## 8.1 Payslips

> **Mockup —** [Payslips tab](../mockups/08-salaries.html#payslips)

- **Contract selector** scopes the whole screen. Every table and chart covers the selected contract only. **No figure anywhere sums across contracts**, and there is no cross-contract comparison.
- The **Contracts tab** beside it is where contracts are created and edited ([§4.3](04-accounts.md#43-creating-and-editing)).
- **Per-year table** is always visible and complete; selecting a row swaps the payslip table below it. Its columns are the year, its **payslip count**, annual contract gross, total gross, total net salary, working days and the two hourly figures ([§11.7](11-calculations.md#117-salary-figures)) — totals and hourly rates, never averages. `Working days` is editable here — it **is** the ContractYear record, created by typing into the cell and **deleted by clearing it**, which puts the year back exactly where it was before the number was typed ([§13](13-validation.md)). That delete is the one that is not confirmed ([§4.3](04-accounts.md#43-creating-and-editing)).
- **One row per calendar year from the contract's start year to its end year**, or to the current year while the contract is running, ascending. **The rows come from the contract's own dates and not from the payslips**: a year in the middle with nothing recorded in it is a year that shows zeros and an empty working-days cell.
- **A year with no ContractYear record shows an empty working-days cell**, and the two hourly columns read *undefined* rather than zero or a dash ([§11.7](11-calculations.md#117-salary-figures)). Type the number and the row completes itself.
- **Working days is always the whole calendar year**, never the part worked. In a partial first or last year the hourly figures are consequently understated — 2017 and 2026 in the mockup — and that is accepted rather than corrected.
- **Payslip table** shows every payslip of the selected year, by the month the pay is for. A month may hold several; the *tredicesima* is a second December row with a label, not a synthetic thirteenth month. It carries no car deduction and no pension contributions, which is why more of it reaches the bank than of an ordinary month's pay.
- **Its columns are the month, the label, then every stored figure on the payslip in the order [§2](02-domain-model.md) lists them** — contract gross, gross, net payment, refunds, car, and the three pension figures **employee**, **employer** and **TFR** — and then notes. **The one derived column is inserted rather than appended**: **net salary** ([§11.7](11-calculations.md#117-salary-figures)) sits immediately after `carPayment`, beside the three entered figures it is made of, which is the one departure from [§2](02-domain-model.md)'s order and the only one. **Twelve columns**, which is every field of the record except `id`, `contractId`, carried by the selector above, and `year`, carried by the row selected in the per-year table.
- **Ordered by month ascending, then by label alphabetically with the unlabelled row first.**
- **`Gross` is the payslip's own *totale lordo* line, typed as printed** ([§2](02-domain-model.md)), and it is the only column here whose meaning comes from the document rather than from this specification. **Nothing on this screen divides a net figure by it** ([§15](15-out-of-scope.md)): everything that reads `gross` — its total on the per-year table, the averages chart, `Gross / hour` — is a sum, a mean or a rate over that one field, so whatever the employer's line contains, those figures agree with each other and across years ([§11.7](11-calculations.md#117-salary-figures)).
- **`Net payment` may be negative**, alone among the figures on this screen ([§13](13-validation.md)): a December whose year-end tax recalculation exceeds the month's net is a real payslip and is entered as printed. `Net salary` follows it down, and check 4 looks for a debit of that amount or reports the payslip when the employer carried the debt forward instead ([§9](09-checks.md)).
- A payslip's money often reaches the bank the following month. The screen does not care — every figure here comes from the payslips — but checks 4 and 5 do, and they look one month ahead ([§11.6](11-calculations.md#116-derived-matching)).
- **Two charts, side by side, covering every year of the contract.** *Average per month, per year* plots `yearAvgGross` and `yearAvgNet` ([§11.7](11-calculations.md#117-salary-figures)); *Totals per year* plots total gross, total net salary and the contract line, *contract × months*, which uses the contract's own `monthsPerYear` and is drawn dashed because it is a term rather than a measurement.
- Payslips are edited in place; the row menu holds **Duplicate** and **Delete**. Duplicate copies every field including `year`, `month` and `label` — a month may legitimately hold more than one payslip ([§2](02-domain-model.md)), so the copy is valid where it lands. **Add payslip** opens a form with the eleven stored fields the table shows, **every one of them empty**: no month is proposed, no figure is carried over from the previous payslip, and nothing on the form is filled in on the user's behalf ([§5.5](05-transactions.md#55-add-transaction)). Duplicate is what exists for a row that resembles another.

## 8.2 Contracts

> **Mockup —** [Contracts tab](../mockups/08-salaries.html#contracts)

- One row per employer, **ordered by `startDate`, then by name** to break the tie.
- **Months per year** and **hours per day** are contract terms that every figure on the other tab divides by, which is why the two tabs sit together: this is the denominator, that is the numerator.
- **A contract is never retired, only ended.** Filling in `endDate` records when it finished; it stays in the selector, keeps its payslips and keeps its years. There is nothing to exclude from a total, because no figure in the application sums across contracts ([§8.1](#81-payslips)).
- **The dates cannot be narrowed past the records that depend on them.** The form refuses it and names what is in the way ([§13](13-validation.md)). Widening is always fine, and is what an employer extending a contract looks like.
- **Payslips** counts what points at the contract, and is what decides whether it can be deleted: at zero it can, otherwise it cannot ([§4.3](04-accounts.md#43-creating-and-editing)). Its ContractYear records go with it.
- Changing `monthsPerYear` or `hoursPerDay` re-computes every derived figure on the Payslips tab for every year, **including years already closed**. There is no history of contract terms — the current values are applied to the whole contract.

---

## Why it is this way

- **The screen is scoped to one contract** so that figures depending on contract terms never mix across employers.
- **The per-year table is built from the contract's dates rather than from the payslips** because a year with nothing recorded in it is a fact worth seeing, and because it is the only way that year's ContractYear can be created at all — a table built from the payslips would have no row to type into for the year whose payslips are the thing that is missing.
- **A missing working-days figure reads *undefined*** because nothing is invented and nothing is hidden: a year whose denominator is missing has no hourly pay, and saying so is more use than a plausible figure computed from a guess. The empty cell is the invitation.
- **Whole-calendar-year working days are accepted, understatement and all**, because a year-to-date denominator would have to be re-entered every month to stay true, and the years that matter for comparison are the complete ones. Full years carry the tredicesima in the numerator and no extra hours in the denominator, so hourly pay reads as total pay per hour worked, which is the intended reading.
- **The one derived payslip column sits where it does** because it reads against the entered figures to its left: net salary next to the payment and the two adjustments it is made of. Appending it instead would have put the whole of the monthly pay on one side of the table and its summary at the far end, past three pension figures that have nothing to do with it.
- **There is no net-to-gross ratio, and dropping it removed a problem rather than a feature** ([§15](15-out-of-scope.md)). It was a percentage nobody acted on — the wedge between gross and net is set by tax law and does not move month to month in any way this screen could respond to — and it was the only figure in the application that divided an exactly-defined number by one copied off a document, which is what made the composition of the *totale lordo* line matter at all ([§11.7](11-calculations.md#117-salary-figures)). Everything still reading `gross` reads it the same way, so the question it raised no longer has anywhere to bite.
- **The pension contribution is three columns rather than one** because the fund credits the three parts separately, and a payslip prints them separately ([§2](02-domain-model.md)). Recording them as they are printed is what lets check 5 pair each one against the credit that carries it ([§9](09-checks.md)) instead of reconciling a total nobody's statement shows.
- **The label breaks the ordering tie** because a label is what distinguishes the second payslip of a month from the first; and the ordinary monthly payslip is the one that has none, which puts December's pay above December's tredicesima — the order they were earned in, and the order they are read in.
- **The two charts answer different questions and neither replaces the other.** The averages say what a month of that year was worth and are the only salary figures a partial year does not distort, because they divide by the payslips there actually were. The totals say what the year paid, which is the figure the contract line can be read against — and a partial first or last year shows visibly below that line, which is correct, not a defect.
- **Duplicate exists for the tredicesima**, the case where a month legitimately holds a second payslip. It is also the answer to the form proposing nothing: a payslip that is mostly last month's is copied from last month's, where every figure comes across and is visibly a copy, rather than typed into a form that had quietly filled two boxes in from a record the user was not looking at. **A default nobody sees themselves accept is a figure that gets saved unread**, and a payslip is a dozen amounts read off a PDF once a month — a wrong contract gross carried forward silently is exactly the kind of thing that survives for a year ([§5.5](05-transactions.md#55-add-transaction)).
- **Contracts are ordered by start date** because employment reads as a sequence — this job, then that one — so the list is the working life in the order it happened, and the current contract is the last row rather than wherever the alphabet put it. The tie-break exists only to make the order total; two contracts starting on one day is someone holding two jobs at once, which the model allows and nothing else in the application cares about.
- **Narrowing a contract's dates is refused** because the per-year table is built from `startDate` and `endDate`, so moving either inwards would take rows off that table and leave the payslips and working days in them with nowhere to be seen.
- **Contract terms have no history** because applying the current values to the whole contract is correct for a term that has never changed, and is the reason a genuine change of terms is a new contract.

---

[← §7 Investments](07-investments.md) · [§9 Checks →](09-checks.md)
