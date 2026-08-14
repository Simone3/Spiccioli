# §10 — Settings — why it is this way

*[Index](../README.md) · [the specification](../specs/10-settings.md)*

---

- **The decimal separator cannot be none** because without it two decimals would run into the units.
- **The amount field takes its decimal character from the preference** because the alternative was to accept both and decide afterwards, which is interpretation, or to fix one in the code, which would put a keyboard the user cannot reach behind a screen that exists to let them choose one. The question a form has to answer is which key produces the separator; the question it must never ask is what the digits around it meant.
- **Display, entry and import are three separate things, and none of them guesses.** Entry is pickers and validated fields, so nothing typed ever needs interpreting. A paste does need it — the characters in a bank export mean whatever that bank meant by them — so the import screen asks, in three controls, rather than inferring from the rows or reaching in here for an answer. It opens those controls at these values because a person's own bank usually writes numbers the way that person reads them, which makes the defaults right most of the time and visibly wrong the rest. That is a starting position, not an interpretation: the control is on screen and the preview answers it row by row. Nothing an import control is set to is ever written back here, so a paste from someone else's bank cannot change how this application prints a date.
- **Preferences living with the installation is a deliberate trade and it points one way.** Formats and thresholds describe the person reading, not the money recorded: the same user wants the same date order in every file they open, and the alternative — preferences inside each file — means opening a second ledger silently repaints the first one's conventions and two files can disagree about how to print a date. The cost is that a file handed to someone else arrives with their formats, not yours, which is the correct outcome for everything on this screen.
- **The line at the top exists** because a settings screen inside a file-based application is otherwise assumed to be part of the file.
- **The paths are shown here** because the window title carries only the file's name and the backup folder is otherwise invisible — a path is too long to read at a glance and too useful to hide.
- **Reference data lives on the screen that consumes it** so that editing a thing and seeing what it does are the same trip.

---

[← §9 Checks](09-checks.md) · [§11 Calculations →](11-calculations.md)
