# Spiccioli

A private ledger for one person: a desktop application for macOS, Windows and Linux that keeps accounts, transactions, investments and salaries in one file you choose.

No account, no server, no synchronization service of its own. The file lives wherever you put it — including a folder a cloud client is syncing — and Spiccioli keeps rotated backup copies beside it.

## Status

**Feature complete, not yet released.** All eight screens below are built and everything on this page works. There is no installer to download yet: until the first release is cut, Spiccioli is run from source — Node 24 or later, then `npm install` and `npm start`, which the technical reference below sets out in full.

## What it does

- **Portfolio** — everything owned, in one figure and broken down.
- **Accounts** — the institutions and accounts the money sits in.
- **Transactions** — the bank exports, categorized by rules you control, with a bulk import for pasted rows.
- **Categories** — the category list and the rules that assign one to a transaction.
- **Investments** — holdings, trades, securities and prices, with prices updated on request.
- **Salaries** — contracts, payslips and what they should have paid.
- **Checks** — the consistency checks that tell you where two independent records disagree.
- **Settings** — the handful of preferences, every one of them a closed set or a bounded number.

Euro only, English only, one dark theme, and nothing that is calculated is ever stored.

## Documentation

- [`docs/functional/`](docs/functional/README.md) — the functional analysis: every screen, every form, every calculation and every check, with the reasoning behind each decision.
- [`docs/technical/`](docs/technical/README.md) — the implementation reference: architecture, repository map, how to build and run it from source.

## License

[Apache License 2.0](LICENSE).
