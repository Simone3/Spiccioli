# §6 — Styling

*[Index](README.md) · [← §5 Text and languages](05-text-and-languages.md)*

---

## 6.1 Plain CSS, one file per component

No CSS framework, no CSS-in-JS, no preprocessor. A component that needs styles has a `.css` file of the same name beside it and imports it at the top of its module:

```tsx
import 'src/components/launch/LaunchScreen.css';
```

Vite collects those imports into one stylesheet at build time. Class names are namespaced by hand with the component's own name — `launch-screen`, `launch-screen-title` — because there is no scoping mechanism and a collision would be silent.

`src/index.css` is the only global stylesheet: the theme variables, the `body`, the React root, and the focus ring.

## 6.2 One theme, and it is dark

[§1](../functional/specs/01-premise-and-constraints.md) fixes a dark theme only — no light theme, no switch, no system preference to follow. So the variables in `src/index.css` are *the* colors rather than one theme's set of them, and there is no second block to keep in step.

Every color is written as a variable and used through `var(--…)`. A color written inline in a component is a bug: it is what makes a later change to the palette a search-and-replace across the tree.

The groups are:

| Group | What it covers |
| --- | --- |
| Main | Backgrounds, text, accent, borders, overlays and the two interactive backgrounds |
| States | Danger in its several strengths, warning, disabled, the green a positive amount is printed in, and the violet that marks a category a rule assigned rather than one the user set |
| Charts | Five series colors, eleven slice colors, a grid and an axis. A chart names a series by its number and a slice by its rank rather than either by a color, so two charts never draw the same thing two different ways |
| Fonts | The one family: Inter, self-hosted through `@fontsource/inter`, with a system fallback |
| Focus | The one ring, described below |

The accent is amber, and it is also the first chart series: the first line of a chart is its headline figure.

**There are eleven slice colors because the breakdown by type has a ceiling of eleven** — the seven cash types and the four security types ([§3.1](../functional/specs/03-portfolio.md#31-behaviour)). **The first five are the series colors themselves**, by reference rather than by repeated value, so one chart never contradicts another; the six after them extend the same family rather than starting a second one.

**The charts are SVG, which is what keeps them inside this rule** (D8). A `stroke` is written as `var(--colors-chart-series-1)` in the markup, exactly like every other color in the application, where a canvas library would have each one read out with `getComputedStyle` and passed in as a string. **Two files import the library and no others do** — `src/components/common/LineChart.tsx` and `src/components/common/PieChart.tsx` — and they are also the only two that turn a series number or a slice rank into a variable name.

Inter is imported in `src/index.tsx` at weights 300 and 700 and bundled with the application: nothing is fetched from a font CDN at runtime, which the Content-Security-Policy would refuse anyway.

## 6.3 The focus ring

One rule, in `src/index.css`, on `:focus-visible`:

```css
:focus-visible {
	outline: none;
	box-shadow: var(--focus-ring);
}
```

Three decisions are packed into it.

- **A shadow, not an outline**, so the ring follows the shape the control already has, whether or not it has a border.
- **`:focus-visible`, not `:focus`**, so a control lights up when the keyboard reaches it and stays quiet when the pointer clicks it. A field the user is about to type into matches `:focus-visible` on a click too, which is exactly where a ring is expected.
- **Two shadows, not one.** The ring is separated from what it surrounds by a dark hairline, so it stays visible even on a control filled with the accent color itself.

**Every focusable control shows this ring and none of them draws its own.** A control that genuinely has to override it must say why in a comment next to the override. Where something would clip the ring, give it room rather than dropping it.

This is also why anything clickable is a real `<button>` or `<a>` and never a clickable `<div>`: the keyboard has to reach it and activate it, and the ring has to have something to draw around.

Two overrides exist today and both say why where they are written. `DecimalField` draws the ring on the box around its input with `:focus-within`, because the box with its currency symbol and its unit is what the user sees as the field, and the bare input inside it drops the ring so there is only ever one. `DateField` puts the ring back on the calendar's days, which the library it is built on draws an outline of its own on.

## 6.4 A library's stylesheet

`react-datepicker` is the only dependency that ships CSS, and it ships a light calendar. `src/components/common/DateField.css` imports the library's stylesheet first and then overrides it — the surfaces, the borders, the text, the selected day and the focus outline — so that the calendar is the same dark theme as everything around it. **That override lives in the one file that imports the library**, which is what keeps replacing the date picker a change in one folder.

The drag library of [§8.1](08-decisions.md#81-the-fourteen-decisions) D10 ships none: `RulesTable` styles its own handle and its own dragged row, and writes the row's transform by hand rather than importing the transitive `@dnd-kit/utilities` helper that would format it. What the library does contribute to the page is **a visually hidden live region of its own**, which is where the translated drag announcements are read out from.

---

[← §5 Text and languages](05-text-and-languages.md) · [§7 Testing →](07-testing.md)
