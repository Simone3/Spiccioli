# §14 — Empty and error states — why it is this way

*[Index](../README.md) · [the specification](../specs/14-empty-and-error-states.md)*

---

- **Empty-because-filtered and empty-because-nothing-exists are kept apart** because confusing the two makes a user hunt for data that was never there.
- **The two blocking errors are the exceptions because neither leaves anything worth doing.** Every other error still allows the next action to be a good one; those two mean the ledger in front of the user is not the ledger on disk, and every keystroke after that point is work being typed into something that cannot keep it.

---

[← §13 Validation](13-validation.md) · [§15 Out of scope →](15-out-of-scope.md)
