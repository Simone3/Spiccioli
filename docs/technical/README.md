# Spiccioli — technical reference

**Implementation documentation**

How Spiccioli is built: the processes it runs in, where every file lives, how it is built and released, what the framework layer is, and the conventions that only make sense next to the code.

This is the counterpart to [`docs/functional/`](../functional/README.md). The functional analysis says **what** the application does and **why** it does it that way; these pages say **how** it is put together. Where the two touch, the functional analysis wins: a disagreement between them is a defect in these pages.

---

## Contents

| § | Section | What it answers |
| --- | --- | --- |
| 1 | [Architecture](01-architecture.md) | Which process runs what, and how the two talk |
| 2 | [Repository map](02-repository-map.md) | Where every file is and what it is for |
| 3 | [Build and run](03-build-and-run.md) | The commands, the development loop, packaging and releasing |
| 4 | [Framework layer](04-framework.md) | What `src/framework` is, what is in it, and what Spiccioli uses of it |
| 5 | [Text and languages](05-text-and-languages.md) | How wording reaches the screen |
| 6 | [Styling](06-styling.md) | The theme, the variables, and the focus ring |
| 7 | [Testing](07-testing.md) | What is tested, where the tests live, and what they may depend on |
| 8 | [Implementation plan](08-implementation-plan.md) | The decisions taken, and the twelve phases from here to v1 |
| | [ — why the decisions went this way](08-implementation-plan-why.md) | What each of §8's decisions was taken *on* — read only when one is questioned |

Sections are added as the application grows: persistence, the data model and the screens get theirs when they are built.

## How this is organised

```
docs/technical/
├── README.md          this file — the index and the conventions
├── NN-name.md         one Markdown file per section, numbered as the section
└── NN-name-why.md     the reasoning behind a section, split out only where it would
                       otherwise be re-read on every pass — §8 alone, so far
```

- **The numbers are stable.** `§4` means section 4, and file names carry the same number so a directory listing reads in document order. A new section takes the next number rather than renumbering the ones already written.
- **Each file is self-contained enough to act on.** Reading one section should be enough to change the area it covers, with cross-references for what it deliberately does not repeat.
- **Rules do not live here.** What Claude Code must and must not do is in [`CLAUDE.md`](../../CLAUDE.md); these pages explain the code, and the two are kept non-overlapping.
- **Reasoning is inline, with one exception.** Unlike the functional analysis, there is no `why/` folder: an implementation decision is explained where it is described, because the two are read together. **[§8](08-implementation-plan.md) is the exception**, and only because of how it is read — the plan is opened on the way into every phase while the grounds behind its thirteen decisions are wanted once, when one is questioned, so they live in [`08-implementation-plan-why.md`](08-implementation-plan-why.md) and the plan states outcomes. A section splits its reasoning out only when it earns it that way.

## Conventions

- A cross-reference within these pages is written `§N` and links to the file it names. A reference into the functional analysis is written the way that document writes it, `§N` or `§N.M`, and links there.
- File paths are written relative to the repository root, in backticks: `src/main/Main.ts`.
- A statement about behaviour that is not implemented yet says so. These pages describe the code as it is, never as it is planned to be. **[§8](08-implementation-plan.md) is the one exception and is entirely about what is planned** — which is why it is a section of its own rather than a paragraph in each of the others, and why it is kept current as phases land.
