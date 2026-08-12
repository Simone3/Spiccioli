# §8 — Salaries

*[Index](../README.md) · [mockups for this section](../mockups/08-salaries.html)*

Two tabs: Payslips, Contracts. Scoped to one contract, then to one year.

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

- One row per employer. **Months per year** and **hours per day** are contract terms that every
  figure on the other tab divides by, which is why the two tabs sit together: this is the
  denominator, that is the numerator.
- **A contract is never retired, only ended.** Filling in `endDate` records when it finished; it
  stays in the selector, keeps its payslips and keeps its years. There is nothing to exclude from a
  total, because no figure in the application sums across contracts ([§8.1](#81-payslips)).
- **Payslips** counts what points at the contract, and is what decides whether it can be deleted: at
  zero it can, otherwise it cannot ([§4.3](04-accounts.md#43-creating-and-editing)). Its
  ContractYear records go with it.
- Changing `monthsPerYear` or `hoursPerDay` re-computes every derived figure on the Payslips tab for
  every year, including years already closed. There is no history of contract terms — the current
  values are applied to the whole contract, which is correct for a term that has never changed and
  is the reason a genuine change of terms is a new contract.

---

[← §7 Investments](07-investments.md) · [§9 Checks →](09-checks.md)
