# §1 — Premise and constraints — why it is this way

*[Index](../README.md) · [the specification](../specs/01-premise-and-constraints.md)*

---

- **The organising principle** is the unlinked pair of sources. Because neither side is generated from the other, a disagreement between them is real evidence rather than a bookkeeping artefact, and reporting those disagreements is what [§9](../specs/09-checks.md) exists to do.
- **Currency is left out rather than recorded against the future.** A second currency will be a real piece of work when it comes — a field on accounts and securities, a rate table, and a decision at every total about what is being added to what — and recording a currency now, on the strength of that, would have been one value with one possible setting, present on two forms and read by nothing. It would not have made that day any easier. Because nothing records a currency, there is nothing that could be set to another one and then be wrong.
- **The platform-shaped exceptions are kept to two** so that “the same build behaves identically on each” stays a statement that can be checked. Preferences have to live somewhere the platform dictates, and the menu bar has to be drawn where the platform draws it; neither changes what the application does, which is why neither is put to the user as a question.
- **Assets-only is recorded as a premise rather than discovered as a gap.** A figure called net worth in an application that cannot hold a debt is correct for a person with none and quietly wrong for everyone else, and the difference is not visible on any screen. Saying so here costs a line; a `Liability` account type carrying a negative balance is most of what it would take to lift the restriction, and it is deliberately not built ([§15](../specs/15-out-of-scope.md)).
- **The one stored derived value earns its exception** by being read constantly: holding a rule-assigned category in step with the rule list lets every total read the stored value instead of re-deriving it behind each figure ([§2](../specs/02-domain-model.md)).

---

[§2 Domain model →](02-domain-model.md)
