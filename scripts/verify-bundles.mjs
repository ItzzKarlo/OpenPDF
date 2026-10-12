import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/verify-bundles.mjs <Rust target triple>');

const expectedArch = target.startsWith('aarch64-') ? 'arm64' : 'x86_64';
const releaseDir = path.resolve('src-tauri', 'target', target, 'release');
const bundleDir = path.join(releaseDir, 'bundle');
const platform = target.includes('apple-darwin') ? 'macos' : target.includes('windows-msvc') ? 'windows' : 'linux';

async function walk(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await walk(item));
    else found.push(item);
  }
  return found;
}

function detectBinaryArchitecture(buffer) {
  if (buffer[0] === 0x7f && buffer.subarray(1, 4).toString() === 'ELF') {
    const machine = buffer[5] === 2 ? buffer.readUInt16BE(18) : buffer.readUInt16LE(18);
    return machine === 183 ? 'arm64' : machine === 62 ? 'x86_64' : `ELF machine ${machine}`;
  }
  if (buffer.subarray(0, 2).toString() === 'MZ') {
    const header = buffer.readUInt32LE(0x3c);
    const machine = buffer.readUInt16LE(header + 4);
    return machine === 0xaa64 ? 'arm64' : machine === 0x8664 ? 'x86_64' : `PE machine 0x${machine.toString(16)}`;
  }
  const magic = buffer.readUInt32LE(0);
  if (magic === 0xfeedfacf) {
    const cpu = buffer.readUInt32LE(4);
    return cpu === 0x0100000c ? 'arm64' : cpu === 0x01000007 ? 'x86_64' : `Mach-O CPU 0x${cpu.toString(16)}`;
  }
  return 'unknown';
}

async function assertArchitecture(file, arch = expectedArch) {
  const actual = detectBinaryArchitecture(await readFile(file));
  if (actual !== arch) throw new Error(`${file} has architecture ${actual}; expected ${arch}`);
  console.log(`Verified ${arch} binary: ${path.relative(process.cwd(), file)}`);
}

const files = await walk(bundleDir);
const requireFiles = (label, predicate, count = 1) => {
  const matches = files.filter(predicate);
  if (matches.length < count) throw new Error(`Missing ${label} below ${bundleDir}`);
  for (const match of matches) console.log(`Verified ${label}: ${path.relative(process.cwd(), match)}`);
  return matches;
};

if (platform === 'macos') {
  const appDir = path.join(bundleDir, 'macos', 'OpenPDF.app');
  const infoPlist = path.join(appDir, 'Contents', 'Info.plist');
  const executable = spawnSync('plutil', ['-extract', 'CFBundleExecutable', 'raw', '-o', '-', infoPlist], { encoding: 'utf8' });
  if (executable.status !== 0 || !executable.stdout.trim()) {
    throw new Error(`Unable to read CFBundleExecutable from ${infoPlist}: ${executable.stderr}`);
  }
  const appBinary = path.join(appDir, 'Contents', 'MacOS', executable.stdout.trim());
  console.log(`macOS bundle executable: ${executable.stdout.trim()}`);
  await assertArchitecture(appBinary);
  requireFiles('DMG', (file) => file.endsWith('.dmg'));
  const verify = spawnSync('codesign', ['--verify', '--deep', '--strict', appDir], { encoding: 'utf8' });
  if (verify.status !== 0) throw new Error(`macOS bundle signature verification failed: ${verify.stderr}`);
  console.log('Verified macOS app bundle signature');
} else if (platform === 'windows') {
  await assertArchitecture(path.join(releaseDir, 'openpdf.exe'));
  requireFiles('NSIS installer', (file) => file.endsWith('-setup.exe'));
  requireFiles('MSI installer', (file) => file.endsWith('.msi'));
} else {
  await assertArchitecture(path.join(releaseDir, 'openpdf'));
  const appImages = requireFiles('AppImage', (file) => file.endsWith('.AppImage'));
  for (const appImage of appImages) await assertArchitecture(appImage);
  const debs = requireFiles('Debian package', (file) => file.endsWith('.deb'));
  const expectedDebArch = expectedArch === 'arm64' ? 'arm64' : 'amd64';
  for (const deb of debs) {
    const result = spawnSync('dpkg-deb', ['--field', deb, 'Architecture'], { encoding: 'utf8' });
    if (result.status !== 0 || result.stdout.trim() !== expectedDebArch) {
      throw new Error(`${deb} has Debian architecture ${result.stdout.trim() || 'unknown'}; expected ${expectedDebArch}`);
    }
    console.log(`Verified Debian architecture ${expectedDebArch}`);
  }
}

