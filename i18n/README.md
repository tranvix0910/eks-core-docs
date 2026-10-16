# Maintaining the English and Vietnamese editions

English remains the default at `/eks-core-docs/`. Vietnamese is published at `/eks-core-docs/vi/`. The navbar uses Docusaurus's `localeDropdown`, which opens the matching page in the other language.

The original English documentation remains in `docs/`. Vietnamese copies use the same filenames, IDs, and slugs under `i18n/vi/docusaurus-plugin-content-docs/current/`. Keep command examples and configuration blocks identical to English. Vietnamese headings retain explicit English anchor IDs so section links and bookmarks work in either edition.

| Content | Translation source |
|---|---|
| Documentation | `vi/docusaurus-plugin-content-docs/current/` |
| Sidebar categories and explicit labels | `vi/docusaurus-plugin-content-docs/current.json` |
| Navbar labels | `vi/docusaurus-theme-classic/navbar.json` |
| Homepage, accessibility labels, and theme messages | `vi/code.json` |
| HTML dropdown menus | `vi/snippets/` |

Homepage components use `translate()` from `@docusaurus/Translate`. Their existing English strings remain the default messages. The HTML dropdown copies include the Vietnamese URL prefix because raw HTML links do not receive Docusaurus Link's automatic locale handling.

## Preview both editions together

```bash
npm run check:i18n
npm run build
npm run serve -- --no-open --port 3003
```

Open `http://localhost:3003/eks-core-docs/` and switch languages. The production build includes both locales; GitHub Pages deploys the entire `build/` directory.

A development server serves one locale at a time:

```bash
npm start -- --locale vi --no-open
```

Use the production preview when testing the language selector. A development server started for English alone cannot serve Vietnamese routes.

## Update translations

When an English page changes, update its Vietnamese counterpart without changing technical identifiers or executable examples. Add the counterpart whenever you add a new page. Keep the page's `id` and `slug` unchanged and retain anchors referenced by other pages.

After adding translatable UI strings, extract their entries:

```bash
npm run docusaurus -- write-translations --locale vi
```

Translate new messages in the generated JSON files. The command extracts messages; it does not translate them. It preserves existing translations. Then run `npm run check:i18n` and `npm run build`. The deployment workflow runs both checks before publishing.
