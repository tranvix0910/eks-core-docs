// Keep translated routes complete and executable examples identical to English.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const YAML = require('yaml');
const concepts = require('./vi-workshop-concepts.json');

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
const workshopCapture = /^\/img\/workshop\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.png$/;
const destinations = (text) => [...text.replace(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm, '')
  .matchAll(/\]\(([^)]+)\)|\bto="([^"]+)"/g)]
  .map((match) => match[1] ?? match[2])
  .filter((destination) => {
    // Practice screenshots may differ by locale; navigation and all other links must match.
    if (!destination.startsWith('/img/workshop/')) return true;
    assert(workshopCapture.test(destination), `Invalid workshop capture path: ${destination}`);
    const asset = path.join(root, 'static', destination);
    assert(fs.existsSync(asset) && fs.statSync(asset).isFile(), `Missing workshop capture: ${destination}`);
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert(fs.readFileSync(asset).subarray(0, 8).equals(pngSignature), `Invalid PNG capture: ${destination}`);
    return false;
  }).sort();

const sourceFiles = documentPaths(docs);
assert.deepEqual(documentPaths(translated), sourceFiles, 'Every English document needs a Vietnamese counterpart.');

// Vietnamese lessons add explanations and reading links before the existing labs.
// Keep the English navigation intact, and permit only the declared additions.
const extraLinks = new Map([
  ['index.mdx', new Set()],
  ['00-platform-overview-and-deployment.md', new Set()],
]);
for (const concept of concepts) {
  assert(sourceFiles.includes(concept.file), `Unknown concept document: ${concept.file}`);
  const content = fs.readFileSync(path.join(translated, concept.file), 'utf8');
  assert(content.includes(`{#${concept.anchor}}`), `Missing theory section: ${concept.anchor}`);
  assert(!extraLinks.has(concept.file), `Duplicate concept document: ${concept.file}`);
  extraLinks.set(concept.file, new Set(concept.references));
  extraLinks.get('index.mdx').add(`${concept.route}#${concept.anchor}`);
  extraLinks.get('00-platform-overview-and-deployment.md').add(`${concept.file}#${concept.anchor}`);
}
const compareDestinations = (english, vietnamese, relative) => {
  const remaining = destinations(english);
  const allowed = extraLinks.get(relative) ?? new Set();
  for (const destination of destinations(vietnamese)) {
    const index = remaining.indexOf(destination);
    if (index !== -1) remaining.splice(index, 1);
    else assert(allowed.has(destination), `${relative}: unexpected link destination ${destination}`);
  }
  assert.deepEqual(remaining, [], `${relative}: English link destinations missing`);
};
let examples = 0;
for (const relative of sourceFiles) {
  const english = fs.readFileSync(path.join(docs, relative), 'utf8');
  const vietnamese = fs.readFileSync(path.join(translated, relative), 'utf8');
  assert(!/\[\[\d+\]\]/.test(vietnamese), `${relative}: unresolved translation token`);
  assert.deepEqual(codeBlocks(vietnamese), codeBlocks(english), `${relative}: code examples changed`);
  compareDestinations(english, vietnamese, relative);
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
console.log(`i18n OK: ${sourceFiles.length} translated workshop files, ${concepts.length} theory sessions, ${examples} unchanged code blocks, shared UI in English.`);
