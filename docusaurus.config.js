// Site layout and styling adapted from dyte-io/docs (Apache-2.0).
const { themes } = require('prism-react-renderer');

const fs = require('fs');

const REPO = 'https://github.com/tranvix0910/eks-core-docs';
const currentLocale = process.env.DOCUSAURUS_CURRENT_LOCALE || 'en';
// Navigation stays English, while its links follow the selected workshop locale.
const workshopLinks = (html) => currentLocale === 'vi'
  ? html.replaceAll('href="/eks-core-docs/docs/', 'href="/eks-core-docs/vi/docs/')
  : html;
const platformHTML = workshopLinks(fs.readFileSync('./src/snippets/platform.html', 'utf-8'));
const runbooksHTML = workshopLinks(fs.readFileSync('./src/snippets/runbooks.html', 'utf-8'));

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'EKS Workshop',
  tagline:
    'Deploy and operate microservices with Terraform, Karpenter, ArgoCD, EFS, and centralized observability.',
  url: 'https://tranvix0910.github.io',
  baseUrl: '/eks-core-docs/',
  favicon: '/img/favicon.svg',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenAnchors: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'vi'],
    localeConfigs: {
      en: { label: 'English', htmlLang: 'en' },
      vi: { label: 'Tiếng Việt', htmlLang: 'vi' },
    },
  },

  markdown: {
    // Plain .md files are parsed as CommonMark, so `{}` and `<` in the
    // existing runbooks do not break the MDX compiler.
    format: 'detect',
    mermaid: true,
    hooks: { onBrokenMarkdownLinks: 'warn' },
  },

  themes: [
    '@docusaurus/theme-mermaid',
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        docsDir: currentLocale === 'vi'
          ? 'i18n/vi/docusaurus-plugin-content-docs/current'
          : 'docs',
        docsRouteBasePath: '/docs',
        indexBlog: false,
        highlightSearchTermsOnTargetPage: true,
        removeDefaultStemmer: currentLocale === 'vi',
        removeDefaultStopWordFilter: currentLocale === 'vi',
      },
    ],
  ],

  plugins: [require.resolve('./plugins/tailwind-plugin.cjs')],
  clientModules: [require.resolve('./src/fonts.js')],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: 'docs',
          routeBasePath: '/docs',
          sidebarPath: require.resolve('./sidebars.js'),
          sidebarItemsGenerator: require('./docs-sidebar-generator.js'),
          // README.md is the GitHub entry point; the site uses index.mdx.
          exclude: ['README.md'],
          breadcrumbs: true,
          sidebarCollapsible: true,
          editUrl: ({ docPath }) => currentLocale === 'vi'
            ? `${REPO}/edit/main/i18n/vi/docusaurus-plugin-content-docs/current/${docPath}`
            : `${REPO}/edit/main/docs/${docPath}`,
        },
        blog: false,
        theme: {
          customCss: [
            require.resolve('./src/css/custom.css'),
            require.resolve('./src/css/sidebar-icons.css'),
          ],
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: { defaultMode: 'light', respectPrefersColorScheme: true },
      docs: {
        sidebar: { autoCollapseCategories: true, hideable: true },
      },
      navbar: {
        logo: {
          href: '/',
          src: '/img/logo-light.svg',
          srcDark: '/img/logo-dark.svg',
          alt: 'EKS Core Docs',
          height: '40px',
          width: '150px',
        },
        items: [
          { label: 'Get started', to: '/docs', className: 'guides-top-header' },
          {
            label: 'Labs',
            type: 'dropdown',
            className: 'ec-dropdown',
            items: [{ type: 'html', value: platformHTML, className: 'ec-dropdown' }],
          },
          { label: 'Access & secrets', to: '/docs/eks-security' },
          {
            label: 'Operations',
            type: 'dropdown',
            className: 'ec-dropdown resources-dropdown',
            items: [{ type: 'html', value: runbooksHTML, className: 'ec-dropdown' }],
          },
          { type: 'search', position: 'right' },
          { type: 'localeDropdown', position: 'right' },
          {
            label: 'GitHub',
            href: REPO,
            position: 'right',
            className: 'dev-portal-signup dev-portal-link',
          },
        ],
      },
      prism: {
        theme: themes.github,
        darkTheme: themes.dracula,
        additionalLanguages: ['bash', 'json', 'yaml', 'hcl', 'java', 'docker', 'ini', 'properties'],
        magicComments: [
          {
            className: 'theme-code-block-highlighted-line',
            line: 'highlight-next-line',
            block: { start: 'highlight-start', end: 'highlight-end' },
          },
          {
            className: 'code-block-error-line',
            line: 'highlight-next-line-error',
          },
        ],
      },
      mermaid: { theme: { light: 'neutral', dark: 'dark' } },
    }),
};

module.exports = config;
