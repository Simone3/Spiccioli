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
- Numbers interpolated into a translation are formatted with `Intl.NumberFormat` for the same locale, so a translated sentence and the numbers inside it can never disagree.
- `formatList` joins already-translated fragments the way the locale joins a plain enumeration.

## 5.5 What is not translated

Developer-facing strings stay in the module that owns them and stay in English: log messages, `console` output, and errors only a bug can raise. They are read in a log file or a console, never on screen.

A key no bundle can resolve is reported through `onMissingTranslation` — a console warning — and the key itself is rendered, so a missing string is visible rather than silent.

---

[← §4 Framework layer](04-framework.md) · [§6 Styling →](06-styling.md)
