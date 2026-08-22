# §5 — Text and languages

*[Index](README.md) · [← §4 Framework layer](04-framework.md)*

---

## 5.1 One bundle, and why there is still a translator

Spiccioli ships English and offers no language selector ([§1](../functional/specs/01-premise-and-constraints.md)). The requirement is not that it is translatable — it is that a second language must not be a rewrite: strings stay separable from the code, and dates and decimal separators come from the preferences of [§10](../functional/specs/10-settings.md) rather than from a system locale.

So the translation layer is here in full, and it resolves to the one bundle today. Adding a language is writing its bundle next to `lang/en.ts` and listing it in `TRANSLATION_BUNDLES`.

## 5.2 The three files

| File | Role |
| --- | --- |
| `src/i18n/lang/en.ts` | Every word the user can read. It is a nested object, exported `as const satisfies TranslationTree` |
| `src/i18n/Translations.ts` | The registry: which bundle belongs to which language, and the factory that turns a language into a translator. No React and no Electron — the main process imports it too |
| `src/i18n/TranslationContext.tsx` | The React binding: the provider and the `useTranslator()` hook |

**The English bundle is the source of truth for the key type.** `TranslationKey<SpiccioliTranslations>` is every dotted path that leads to a leaf of it, so a key that does not exist cannot be asked for, and a key renamed in the bundle stops compiling everywhere it is used. A second bundle is typed as the English one, which makes an incomplete translation a compile error rather than a key showing up on screen.

## 5.3 Reaching the translator

- **A component** calls `useTranslator()` and reads `t('some.key')`.
- **Pure logic and the main process** take a translator, or just the labels they need, as a parameter. Neither imports the context.
- **The main process** resolves the language from `app.getLocale()`; **the renderer** resolves it from `navigator.languages`. Both go through `resolveSpiccioliLanguage`, so the two processes cannot end up in different languages.

The main process resolves it **first**, before anything else in startup, so that a failure from that point on has wording to report itself with. A failure before it is a failure to start at all: there is no window and no wording, and the log file is the only place it can be reported from.

## 5.4 Placeholders, plurals and numbers

- Values are interpolated through `{name}` placeholders — `t('placeholder.environment', { version, platform })` — never by string concatenation, so a translation can put them in a different order.
- A placeholder with nothing to fill it is left as it is, so a bundle asking for a value the caller did not pass shows up instead of quietly becoming a gap in the sentence.
- A leaf may be one string or one string per plural category. **Use a plural entry rather than comparing a count against 1**: the category is picked by `Intl.PluralRules` from the `count` parameter, because a count of 1 is not "one" in every language.
- **A number interpolated into a sentence is written the way every other figure on screen is written.** The renderer mounts `TranslationProvider` inside `PreferencesProvider` and hands the translator `useFormatter`'s own way of writing a whole number ([§1.3](01-architecture.md#13-layers-inside-the-renderer)), so `{count}` carries the separators of [§10](../functional/specs/10-settings.md) — `1.200 transactions`, never `1,200 transactions` — and changing a separator redraws every sentence. Nothing has to be pre-formatted for that, and nothing may reach for a locale to do it instead. **The main process is the one exception**: it has no preferences to read, so its translator falls back to the language's own formatting, which is why the figures in its wording are seconds and small counts.
- `selectOrdinal` gives the ordinal category of a position, which is not the category the same number has as a count: English writes *one item* but *1st*, *2nd* and *21st*. The four wordings live in the bundle and this picks between them.
- `formatList` joins already-translated fragments the way the locale joins a plain enumeration.
- **A sentence part of which is a control is still one entry.** The Checks screen states each check's thresholds — the days a price may be stale for, the window either side of a transfer's sending leg — and each of those is a link to the preference that set it, so `Checks.ts` splits the sentence at its `{placeholders}` and hands the screen the runs it is made of. The wording stays one bundle entry with the fragments interpolated into it, never a sentence assembled out of pieces in the code, and a window of zero days is its own entry rather than a count compared against 1.

## 5.5 What is not translated

Developer-facing strings stay in the module that owns them and stay in English: log messages, `console` output, and errors only a bug can raise. They are read in a log file or a console, never on screen.

A key no bundle can resolve is reported through `onMissingTranslation` — a console warning — and the key itself is rendered, so a missing string is visible rather than silent.

---

[← §4 Framework layer](04-framework.md) · [§6 Styling →](06-styling.md)
