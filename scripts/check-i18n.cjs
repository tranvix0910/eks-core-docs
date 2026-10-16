// Keep translated routes complete and executable examples identical to English.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const YAML = require('yaml');

const root = path.resolve(__dirname, '..');
const docs = path.join(root, 'docs');
const translated = path.join(root, 'i18n/vi/docusaurus-plugin-content-docs/current');
const walk = (directory) => fs.readdirSync(directory, {withFileTypes: true})
  .flatMap((entry) => entry.isDirectory()
    ? walk(path.join(directory, entry.name))
    : [path.join(directory, entry.name)]);
const documentPaths = (directory) => walk(directory)
  .filter((file) => /\.mdx?$/.test(file))
  .map((file) => path.relative(directory, file)).sort();
const codeBlocks = (text) => text.match(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm) ?? [];
const frontMatter = (text) => YAML.parse(text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '') ?? {};
const destinations = (text) => [...text.replace(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm, '')
  .matchAll(/\]\(([^)]+)\)|\bto="([^"]+)"/g)]
  .map((match) => match[1] ?? match[2]).sort();

const sourceFiles = documentPaths(docs);
assert.deepEqual(documentPaths(translated), sourceFiles, 'Every English document needs a Vietnamese counterpart.');
let examples = 0;
for (const relative of sourceFiles) {
  const english = fs.readFileSync(path.join(docs, relative), 'utf8');
  const vietnamese = fs.readFileSync(path.join(translated, relative), 'utf8');
  assert(!/\[\[\d+\]\]/.test(vietnamese), `${relative}: unresolved translation token`);
  assert.deepEqual(codeBlocks(vietnamese), codeBlocks(english), `${relative}: code examples changed`);
  assert.deepEqual(destinations(vietnamese), destinations(english), `${relative}: link destinations changed`);
  const sourceMeta = frontMatter(english);
  const targetMeta = frontMatter(vietnamese);
  for (const key of ['id', 'slug', 'draft', 'unlisted']) {
    assert.deepEqual(targetMeta[key], sourceMeta[key], `${relative}: ${key} changed`);
  }
  assert(/[ăâđêôơư\u1ea0-\u1ef9]/i.test(vietnamese), `${relative}: Vietnamese content missing`);
  examples += codeBlocks(english).length;
}

// Only workshop content is translated; the shared website interface stays English.
for (const relative of ['code.json', 'docusaurus-theme-classic/navbar.json']) {
  const read = (locale) => JSON.parse(fs.readFileSync(path.join(root, 'i18n', locale, relative), 'utf8'));
  assert.deepEqual(read('vi'), read('en'), `${relative}: shared UI must stay English in both locales`);
}
console.log(`i18n OK: ${sourceFiles.length} translated workshop files, ${examples} unchanged code blocks, shared UI in English.`);
