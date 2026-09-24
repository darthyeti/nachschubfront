// What the service worker has to hold to run the game without a network, and a
// fingerprint of its contents.
//
// Shared by the generator (make-precache.mjs) and the test that guards it, so
// there is only one definition of "everything the game is made of".

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Files at the root of the repository that the browser asks for by name. */
const ROOT_FILES = ['index.html', 'manifest.webmanifest'];

/**
 * Directories walked whole, with the extensions that belong in the cache.
 * Everything else the repository holds — tests, docs, the concept drawings, the
 * licence texts beside the fonts — is not part of what GitHub Pages serves to a
 * player, so it stays out.
 */
const TREES = [
  { dir: 'src', extensions: ['.js', '.css'] },
  { dir: 'assets/fonts', extensions: ['.woff2'] },
  { dir: 'assets/icons', extensions: ['.png'] },
];

async function walk(root, dir, extensions, out) {
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    const path = posix.join(dir, entry.name);
    if (entry.isDirectory()) await walk(root, path, extensions, out);
    else if (extensions.includes(extname(entry.name))) out.push(path);
  }
}

/**
 * Every file the game needs, as paths relative to the page, sorted so two runs
 * on two machines produce the same list.
 * @param {string} [root]
 * @returns {Promise<string[]>}
 */
export async function collectPrecache(root = ROOT) {
  const files = [...ROOT_FILES];
  for (const { dir, extensions } of TREES) await walk(root, dir, extensions, files);
  return files.sort().map((path) => `./${path.split(sep).join('/')}`);
}

/**
 * Short hash over the list and the contents behind it. It goes into the cache
 * name, so a changed file means a new cache and therefore a real update; the
 * test fails when the generated worker no longer matches the sources.
 */
export async function precacheHash(files, root = ROOT) {
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update('\0');
    hash.update(await readFile(join(root, relative('./', file))));
  }
  return hash.digest('hex').slice(0, 12);
}
