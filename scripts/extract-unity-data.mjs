import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseAssetFile, parseMetaGuid } from './yaml-parse.mjs';

// --- Pure helper, exported for tests ---

export function partitionPairs(canonical, easyIds, mediumIds, pairsByName) {
  const easySet = new Set(easyIds);
  const mediumSet = new Set(mediumIds);
  const easy = [], medium = [], hard = [];
  for (let i = 0; i < canonical.length; i++) {
    const name = canonical[i];
    const pair = pairsByName[name];
    if (!pair) continue;  // skip missing
    if (easySet.has(i))   easy.push(pair);
    if (mediumSet.has(i)) medium.push(pair);
    hard.push(pair);  // hard always includes every pair (mirrors Unity)
  }
  return { easy, medium, hard };
}

// --- CLI entry ---

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  await main();
}

async function main() {
  const unityRoot = args.unity;
  if (!unityRoot) {
    console.error('Usage: node scripts/extract-unity-data.mjs --unity=/path/to/Unity/EmojiFind');
    process.exit(1);
  }
  const outDir = path.resolve('assets');
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(path.join(outDir, 'emoji'), { recursive: true });

  console.log('Building guid -> codepoint map …');
  const guidToCodepoint = await buildGuidToCodepointMap(unityRoot);
  console.log(`  ${Object.keys(guidToCodepoint).length} PNGs indexed`);

  console.log('Parsing .asset files …');
  const pairsByName = await parseAllAssetFiles(unityRoot, guidToCodepoint);
  console.log(`  ${Object.keys(pairsByName).length} pairs extracted`);

  console.log('Reading canonical / easy / medium lists …');
  const canonical = await readCommaList(path.join(unityRoot, 'Assets/Resources/emojiGroupList.txt'));
  const easyIds = (await readCommaList(path.join(unityRoot, 'Assets/Resources/emojiGroupEasyList.txt'))).map(Number);
  const mediumIds = (await readCommaList(path.join(unityRoot, 'Assets/Resources/emojiGroupMediumList.txt'))).map(Number);

  const partitioned = partitionPairs(canonical, easyIds, mediumIds, pairsByName);
  console.log(`  easy: ${partitioned.easy.length}, medium: ${partitioned.medium.length}, hard: ${partitioned.hard.length}`);

  await fs.writeFile(path.join(outDir, 'pairs.json'), JSON.stringify(partitioned));
  console.log('Wrote assets/pairs.json');

  console.log('Copying Twemoji PNGs …');
  const srcEmojiDir = path.join(unityRoot, 'Assets/Resources/tweetemoji-72x72');
  const dstEmojiDir = path.join(outDir, 'emoji');
  let copied = 0;
  for (const guid of Object.keys(guidToCodepoint)) {
    const codepoint = guidToCodepoint[guid];
    const src = path.join(srcEmojiDir, `${codepoint}.png`);
    const dst = path.join(dstEmojiDir, `${codepoint}.png`);
    await fs.copyFile(src, dst);
    copied++;
  }
  console.log(`  copied ${copied} PNGs`);
}

async function buildGuidToCodepointMap(unityRoot) {
  const dir = path.join(unityRoot, 'Assets/Resources/tweetemoji-72x72');
  const entries = await fs.readdir(dir);
  const map = {};
  for (const entry of entries) {
    if (!entry.endsWith('.png.meta')) continue;
    const guid = parseMetaGuid(await fs.readFile(path.join(dir, entry), 'utf8'));
    if (!guid) continue;
    const codepoint = entry.replace(/\.png\.meta$/, '');
    map[guid] = codepoint;
  }
  return map;
}

async function parseAllAssetFiles(unityRoot, guidToCodepoint) {
  const dirs = [
    path.join(unityRoot, 'Assets/EmojiGroupTwitterEmoji'),
    path.join(unityRoot, 'Assets/EmojiGroupTwitterEmoji2'),
  ];
  const pairsByName = {};
  for (const dir of dirs) {
    let entries;
    try { entries = await fs.readdir(dir); } catch { continue; }
    for (const entry of entries) {
      if (!entry.endsWith('.asset')) continue;
      const parsed = parseAssetFile(await fs.readFile(path.join(dir, entry), 'utf8'));
      const a = guidToCodepoint[parsed.sprite1Guid];
      const b = guidToCodepoint[parsed.sprite2Guid];
      if (!a || !b) continue;          // skip orphans
      pairsByName[parsed.name] = { a, b, diff: parsed.diff, first: parsed.first };
    }
  }
  return pairsByName;
}

async function readCommaList(file) {
  const text = await fs.readFile(file, 'utf8');
  return text.trim().split(',').map(s => s.trim()).filter(Boolean);
}
