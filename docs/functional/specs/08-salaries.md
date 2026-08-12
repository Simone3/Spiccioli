# §8 — Salaries

*[Index](../README.md) · [mockups for this section](../mockups/08-salaries.html)*

Two tabs: Payslips, Contracts. Scoped to one contract, then to one year.

---

## In brief

- A **contract selector** scopes the whole screen. **No figure anywhere sums across contracts.**
- **Per-year table**, always visible: one row per calendar year **from the contract's start year to
  its end or the current year**, from the contract's own dates rather than from the payslips.
  Selecting a row swaps the payslip table below it.
- **Working days is editable in that table and *is* the ContractYear record** — created by typing
  into the cell, deleted by clearing it, and that delete is the one that is not confirmed.
- A year with no working days shows an **empty cell and two *undefined* hourly figures**. Working
  days is always the whole calendar year, so a partial year understates them.
- **Payslip table**: month, label, then the stored figures — contract gross, gross, net payment,
  refunds, car — then net salary and net/gross, then pension and notes. **Ordered by month, then by
  label with the unlabelled row first.**
- A month may hold **more than one payslip**; the tredicesima is a second December row with a label.
- **Two charts**: averages per month per year, and totals per year against the contract line.
- **Contracts tab** holds one row per employer, **ordered by start date then name**. A contract is
  ended, never retired. Changing its terms re-computes every year, including closed ones. **Its dates
  cannot be narrowed past a payslip or a working-year that already exists.**

---

## 8.1 Payslips

> **Mockup —** [Payslips tab](../mockups/08-salaries.html#payslips)

- **Contract selector** scopes the whole screen. Every table and chart covers the selected contract
  only, so figures depending on contract terms never mix across employers. There is no
  cross-contract comparison.
- The **Contracts tab** beside it is where contracts are created and edited
  ([§4.3](04-accounts.md#43-creating-and-editing)) — the same place their terms are read all day.
- **Per-year table** is always visible and complete; selecting a row swaps the payslip table below
  it. Its columns are the year, its **payslip count**, annual contract gross, total gross, total net
  salary, net/gross, working days and the two hourly figures
  ([§11.7](11-calculations.md#117-salary-figures)) — totals and rates, never averages. `Working
  days` is editable here — it **is** the ContractYear record, created by typing into the cell and
  **deleted by clearing it**, which puts the year back exactly where it was before the number was
  typed ([§13](13-validation.md)).
- **One row per calendar year from the contract's start year to its end year**, or to the current
  year while the contract is running, ascending. The rows come from the contract's own dates and not
  from the payslips: a year in the middle with nothing recorded in it is a year that shows zeros and
  an empty working-days cell, which is a fact worth seeing and also the only way that year's
  ContractYear can be created at all — a table built from the payslips would have no row to type
  into for the year whose payslips are the thing that is missing.
- **A year with no ContractYear record shows an empty working-days cell**, and the two hourly
  columns read *undefined* rather than zero or a dash. The empty cell is the invitation: type the
  number and the row completes itself. Nothing is invented and nothing is hidden — a year whose
  denominator is missing has no hourly pay, and saying so is more use than a plausible figure
  computed from a guess ([§11.7](11-calculations.md#117-salary-figures)).
- **Working days is always the whole calendar year**, never the part worked. In a partial first or
  last year the hourly figures are consequently understated — 2017 and 2026 in the mockup — and
  that is accepted rather than corrected: a year-to-date denominator would have to be re-entered
  every month to stay true, and the years that matter for comparison are the complete ones. Full
  years carry the tredicesima in the numerator and no extra hours in the denominator, so hourly pay
  reads as total pay per hour worked, which is the intended reading.
- **Payslip table** shows every payslip of the selected year, by the month the pay is for. A month
  may hold several; the *tredicesima* is a second December row with a label, not a synthetic
  thirteenth month. Note it carries no car deduction and no pension contribution, which is why its
  net/gross ratio is higher.
- **Its columns are the month, the label, and then every stored figure on the payslip in the order
  [§2](02-domain-model.md) lists them** — contract gross, gross, net payment, refunds, car — followed
  by the two derived ones, **net salary** and **net/gross**
  ([§11.7](11-calculations.md#117-salary-figures)), then **pension** and notes. Eleven columns, which
  is every field of the record except `contractId`, carried by the selector above, and `year`,
  carried by the row selected in the per-year table. The two derived figures sit where they are
  because each reads against the entered figures to its left: net salary next to the payment and the
  two adjustments it is made of, net/gross next to the gross it divides.
- **Ordered by month ascending, then by label alphabetically with the unlabelled row first.** A
  label is what distinguishes the second payslip of a month from the first, so it is what breaks the
  tie; and the ordinary monthly payslip is the one that has none, which puts December's pay above
  December's tredicesima — the order they were earned in, and the order they are read in.
- A payslip's money often reaches the bank the following month. The screen does not care — every
  figure here comes from the payslips — but checks 4 and 5 do, and they look one month ahead
  ([§11.6](11-calculations.md#116-derived-matching)).
- **Two charts, side by side, covering every year of the contract.** *Average per month, per year*
  plots `yearAvgGross` and `yearAvgNet` ([§11.7](11-calculations.md#117-salary-figures)); *Totals
  per year* plots total gross, total net salary and the contract line, *contract × months*, which
  uses the contract's own `monthsPerYear` and is drawn dashed because it is a term rather than a
  measurement.
- **The two answer different questions and neither replaces the other.** The averages say what a
  month of that year was worth and are the only salary figures a partial year does not distort,
  because they divide by the payslips there actually were. The totals say what the year paid, which
  is the figure the contract line can be read against — and a partial first or last year shows
  visibly below that line, which is correct, not a defect.
- Payslips are edited in place; the row menu holds **Duplicate** and **Delete**. Duplicate copies
  every field including `year`, `month` and `label` — a month may legitimately hold more than one
  payslip ([§2](02-domain-model.md)), so the copy is valid where it lands and the tredicesima is the
  case it exists for. **Add payslip** opens a form with the same fields as the table, defaulting
  `contractGross` and `carPayment` from the previous month.

## 8.2 Contracts

> **Mockup —** [Contracts tab](../mockups/08-salaries.html#contracts)

- One row per employer, **ordered by `startDate`, then by name** to break the tie. Employment reads
  as a sequence — this job, then that one — so the list is the working life in the order it happened,
  and the current contract is the last row rather than wherever the alphabet put it. The tie-break
  exists only to make the order total; two contracts starting on one day is someone holding two jobs
  at once, which the model allows and nothing else in the application cares about.
- **Months per year** and **hours per day** are contract terms that every
  figure on the other tab divides by, which is why the two tabs sit together: this is the
  denominator, that is the numerator.
- **A contract is never retired, only ended.** Filling in `endDate` records when it finished; it
  stays in the selector, keeps its payslips and keeps its years. There is nothing to exclude from a
  total, because no figure in the application sums across contracts ([§8.1](#81-payslips)).
- **The dates cannot be narrowed past the records that depend on them.** The per-year table is built
  from `startDate` and `endDate` ([§8.1](#81-payslips)), so moving either inwards would take rows off
  that table and leave the payslips and working days in them with nowhere to be seen — the form
  refuses it and names what is in the way ([§13](13-validation.md)). Widening is always fine, and is
  what an employer extending a contract looks like.
- **Payslips** counts what points at the contract, and is what decides whether it can be deleted: at
  zero it can, otherwise it cannot ([§4.3](04-accounts.md#43-creating-and-editing)). Its
  ContractYear records go with it.
- Changing `monthsPerYear` or `hoursPerDay` re-computes every derived figure on the Payslips tab for
  every year, including years already closed. There is no history of contract terms — the current
  values are applied to the whole contract, which is correct for a term that has never changed and
  is the reason a genuine change of terms is a new contract.

---

[← §7 Investments](07-investments.md) · [§9 Checks →](09-checks.md)
