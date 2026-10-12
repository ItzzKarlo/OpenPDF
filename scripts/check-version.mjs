import { appendFile, readFile } from 'node:fs/promises';

const tag = process.argv[2];
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const tauriConfig = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
const cargoToml = await readFile(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8');
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const versions = new Map([
  ['package.json', packageJson.version],
  ['src-tauri/tauri.conf.json', tauriConfig.version],
  ['src-tauri/Cargo.toml', cargoVersion],
]);
const uniqueVersions = new Set(versions.values());

if (uniqueVersions.size !== 1 || uniqueVersions.has(undefined)) {
  const details = [...versions].map(([file, version]) => `${file}: ${version ?? 'missing'}`).join('\n');
  throw new Error(`Application versions do not match:\n${details}`);
}

const version = packageJson.version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Application version is not valid SemVer: ${version}`);
}
if (tag && tag !== `v${version}`) {
  throw new Error(`Release tag ${tag} does not match application version v${version}`);
}

const values = [`version=${version}`, `tag=v${version}`, `prerelease=${version.includes('-')}`];
console.log(`Validated OpenPDF ${version}${tag ? ` against ${tag}` : ''}`);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${values.join('\n')}\n`);

