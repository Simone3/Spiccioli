# Spiccioli

A private ledger for one person: a desktop application for macOS, Windows and Linux that keeps accounts, transactions, investments and salaries in one file you choose.

No account, no server, no synchronization service of its own. The file lives wherever you put it — including a folder a cloud client is syncing — and Spiccioli keeps rotated backup copies beside it.

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

## Install

Spiccioli is not signed with a paid Apple or Microsoft certificate, so each operating system will warn you about it the first time. The steps below say what to do about that.

### macOS

Apple Silicon (M1 and later). Intel Macs are not covered by a build yet.

1. Download the `Spiccioli-darwin-arm64-*.zip` file from the [latest release](https://github.com/Simone3/Spiccioli/releases/latest).
2. Unzip it and move `Spiccioli.app` into your `Applications` folder.
3. Remove the quarantine flag macOS put on the download:

```bash
xattr -dr com.apple.quarantine /Applications/Spiccioli.app
```

4. Open Spiccioli normally.

Without step 3 macOS refuses to open the application and reports it as damaged. It is not: the flag is applied to everything downloaded from the internet, and macOS only lets you clear it through this dialog or this command when the application carries no paid developer signature.

### Windows

1. Download the `Spiccioli-Setup.exe` file from the [latest release](https://github.com/Simone3/Spiccioli/releases/latest).
2. Run it. SmartScreen will say the publisher is unknown: choose **More info**, then **Run anyway**.
3. The installer needs no administrator rights and installs Spiccioli for your user only. It adds the usual shortcuts and starts the application when it is done.

### Linux

x86-64, Debian and RPM families.

Download the `.deb` or the `.rpm` file from the [latest release](https://github.com/Simone3/Spiccioli/releases/latest), then install it:

```bash
sudo apt install ./spiccioli_*_amd64.deb
```

```bash
sudo dnf install ./spiccioli-*.x86_64.rpm
```

## Documentation

- [`docs/functional/`](docs/functional/README.md) — the functional analysis: every screen, every form, every calculation and every check, with the reasoning behind each decision.
- [`docs/technical/`](docs/technical/README.md) — the implementation reference: architecture, repository map, how to build and run it from source.

## License

[Apache License 2.0](LICENSE).
