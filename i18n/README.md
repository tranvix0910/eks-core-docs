# Maintaining the English and Vietnamese workshop content

English remains the default at `/eks-core-docs/`. Vietnamese workshop content is published at `/eks-core-docs/vi/docs`. The navbar uses Docusaurus's `localeDropdown`, which opens the matching page in the other language.

Only workshop content and its documentation sidebar are translated. The homepage, header, footer, dropdown menus, search controls, and shared interface stay in English in both locales. Choosing Vietnamese still makes their links open Vietnamese workshop pages.

The original English documentation remains in `docs/`. Vietnamese copies use the same filenames, IDs, and slugs under `i18n/vi/docusaurus-plugin-content-docs/current/`. Keep command examples and configuration blocks identical to English. Vietnamese headings retain explicit English anchor IDs so section links and bookmarks work in either edition.

| Content | Source |
|---|---|
| English workshop content | `../docs/` |
| Vietnamese workshop content | `vi/docusaurus-plugin-content-docs/current/` |
| Vietnamese documentation sidebar | `vi/docusaurus-plugin-content-docs/current.json` |
| Shared English theme and search messages | Identical `en/code.json` and `vi/code.json` |
| Shared English navbar labels | Identical `en/docusaurus-theme-classic/navbar.json` and `vi/docusaurus-theme-classic/navbar.json` |
| Homepage and footer | `../src/pages/` and `../src/components/homepage/` |
| English dropdown menus | `../src/snippets/`; their links follow the locale in `docusaurus.config.js` |

The English entries in `vi/code.json` override Docusaurus's automatic Vietnamese theme translations. Keep these shared UI files identical to their English counterparts. Do not translate homepage, header, or footer copy.

## Preview both editions together

```bash
npm run check:i18n
npm run build
npm run serve -- --no-open --port 3003
```

Open `http://localhost:3003/eks-core-docs/` and switch languages. Both homepages remain English; their workshop links follow the selected locale. The production build includes both editions, and GitHub Pages deploys the entire `build/` directory.

A development server serves one locale at a time:

```bash
npm start -- --locale vi --no-open
```

Use the production preview when testing the language selector. A development server started for English alone cannot serve Vietnamese routes.

## Update workshop translations

When an English workshop page changes, update its Vietnamese counterpart without changing technical identifiers or executable examples. Add the counterpart whenever you add a new page. Keep the page's `id` and `slug` unchanged and retain anchors referenced by other pages.

Translate sidebar labels in `vi/docusaurus-plugin-content-docs/current.json` and page front matter. Keep shared interface labels in English. Run `npm run check:i18n` and `npm run build`; the deployment workflow runs both checks before publishing.
