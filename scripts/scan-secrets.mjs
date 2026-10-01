import process from 'node:process';
import console from 'node:console';
import fs from 'node:fs';
import path from 'node:path';
const files = fs.readdirSync('.').filter(file => /\.(?:ts|tsx|js|mjs|json|md|html|example)$/.test(file) && fs.statSync(file).isFile());
function addDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) addDirectory(filename); else files.push(filename);
  }
}
for (const directory of ['src', 'server', 'scripts', '.github', 'dist']) if (fs.existsSync(directory)) addDirectory(directory);
const signatures = [/AIza[\w-]{35}/, /sk-(?:or-v1-)?[A-Za-z0-9]{32,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
const secrets = ['GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'DATABASE_URL'].map(name => process.env[name]).filter(value => value && value.length >= 12 && value !== 'MY_GEMINI_API_KEY');
let failed = false;
for (const filename of new Set(files)) {
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) continue;
  const content = fs.readFileSync(filename, 'utf8');
  if (signatures.some(pattern => pattern.test(content)) || (filename.startsWith('dist/') && secrets.some(value => content.includes(value)))) {
    console.error(`Possible secret found in ${filename}.`); failed = true;
  }
  if (filename.startsWith('dist/') && /server\.(?:cjs|ts)(?:\.map)?$/.test(filename)) {
    console.error('Backend output must be outside dist.'); failed = true;
  }
}
process.exitCode = failed ? 1 : 0;
if (!failed) console.log('Source and frontend secret scan passed.');
