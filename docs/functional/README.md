# Spiccioli — a private ledger for one person

**Functional analysis · v1**

Everything needed to build the application: the domain model, every screen with its mockup, the
forms behind each action, the calculations, the consistency checks, and what is deliberately left
out. Self-contained — no other document is required to implement it. Sections 3 to 10 are the eight
sidebar items, in sidebar order; where a screen has tabs, each tab is one of its subsections.

---

## Contents

| § | Specification | Mockups |
| --- | --- | --- |
| 1 | [Premise and constraints](specs/01-premise-and-constraints.md) | — |
| 2 | [Domain model](specs/02-domain-model.md) | — |
| 3 | [Portfolio](specs/03-portfolio.md) | [03-portfolio.html](mockups/03-portfolio.html) |
| 4 | [Accounts](specs/04-accounts.md) | [04-accounts.html](mockups/04-accounts.html) |
| 5 | [Transactions](specs/05-transactions.md) | [05-transactions.html](mockups/05-transactions.html) |
| 6 | [Categories](specs/06-categories.md) | [06-categories.html](mockups/06-categories.html) |
| 7 | [Investments](specs/07-investments.md) | [07-investments.html](mockups/07-investments.html) |
| 8 | [Salaries](specs/08-salaries.md) | [08-salaries.html](mockups/08-salaries.html) |
| 9 | [Checks](specs/09-checks.md) | [09-checks.html](mockups/09-checks.html) |
| 10 | [Settings](specs/10-settings.md) | [10-settings.html](mockups/10-settings.html) |
| 11 | [Calculations](specs/11-calculations.md) | — |
| 12 | [Storage](specs/12-storage.md) | [12-storage.html](mockups/12-storage.html) |
| 13 | [Validation](specs/13-validation.md) | — |
| 14 | [Empty and error states](specs/14-empty-and-error-states.md) | — |
| 15 | [Out of scope for v1](specs/15-out-of-scope.md) | — |

Every mockup is also listed on one page: [mockups/index.html](mockups/index.html).

## How this is organised

```
docs/functional/
├── README.md          this file — the index and the shared conventions
├── specs/             one Markdown file per section, numbered as the section
└── mockups/           one HTML file per section that has screens, plus the shared stylesheet
```

- **The written specification is Markdown, the mockups are HTML.** A section's prose lives in
  `specs/NN-name.md`; the screens and dialogs it describes live in `mockups/NN-name.html`, each one
  under its own anchor, so the spec can point at exactly the screen under discussion.
- **The numbers are the specification's vocabulary and never change.** `§7.6` means section 7,
  subsection 6, and it names the same thing here as it did before the document was split. File names
  carry the same number so a directory listing reads in document order.
- **Every file states the specification first and the reasoning last.** The body of a file — its
  numbered subsections, tables and lists — is the specification: what the application does, with no
  argument in it. Every file then ends with **an unnumbered *Why it is this way* section**: why each
  decision is the one taken, what was rejected and what it would have cost. **The closing section
  introduces nothing new** — every fact lives in the specification above it. Read the specification
  to build the screen, read the closing section before changing anything on it, and treat a
  disagreement between the two as a defect in this document.
- **Implementing one screen means reading two files**: the spec for that section and its mockups.
  [§2](specs/02-domain-model.md) is the one other file worth having open, since every screen's
  fields come from it.
- **Sections 1, 2, 11, 13, 14 and 15 have no mockups.** They are the model, the formulas and the
  cross-cutting rules.

## Conventions

- A cross-reference is written `§N` or `§N.M` and links to the file and heading it names.
- In [§2](specs/02-domain-model.md), *italic* marks a field that is derived and never stored.
- A mockup is referenced from the prose at the point it illustrates, as a blockquote:
  > **Mockup —** [Transactions list](mockups/05-transactions.html#list)
- Mockups share one stylesheet, [`mockups/_mockups.css`](mockups/_mockups.css). Each mockup file
  opens on its own in a browser — no server, no build step.
