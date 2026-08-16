# §6 — Styling

*[Index](README.md) · [← §5 Text and languages](05-text-and-languages.md)*

---

## 6.1 Plain CSS, one file per component

No CSS framework, no CSS-in-JS, no preprocessor. A component that needs styles has a `.css` file of the same name beside it and imports it at the top of its module:

```tsx
import 'src/components/common/PlaceholderPage.css';
```

Vite collects those imports into one stylesheet at build time. Class names are namespaced by hand with the component's own name — `placeholder-page`, `placeholder-page-title` — because there is no scoping mechanism and a collision would be silent.

`src/index.css` is the only global stylesheet: the theme variables, the `body`, the React root, and the focus ring.

## 6.2 One theme, and it is dark

[§1](../functional/specs/01-premise-and-constraints.md) fixes a dark theme only — no light theme, no switch, no system preference to follow. So the variables in `src/index.css` are *the* colors rather than one theme's set of them, and there is no second block to keep in step.

Every color is written as a variable and used through `var(--…)`. A color written inline in a component is a bug: it is what makes a later change to the palette a search-and-replace across the tree.

The groups are:

| Group | What it covers |
| --- | --- |
| Main | Backgrounds, text, accent, borders, overlays and the two interactive backgrounds |
| States | Danger in its several strengths, warning, disabled |
| Fonts | The one family: Inter, self-hosted through `@fontsource/inter`, with a system fallback |
| Focus | The one ring, described below |

The accent is amber rather than SPOT's blue, which is the only substantive difference between the two palettes today.

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

---

[← §5 Text and languages](05-text-and-languages.md) · [§7 Testing →](07-testing.md)
