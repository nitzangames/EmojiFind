// Parse a Unity .asset YAML for the fields EmojiFind cares about.
// Unity .asset files are text YAML with predictable inline maps; we parse with
// regex instead of pulling in a YAML library.

export function parseAssetFile(text) {
  return {
    name:        extractKey(text, /^\s*m_Name:\s*(.+)$/m),
    sprite1Guid: extractGuid(text, /^\s*sprite1:\s*\{[^}]*guid:\s*([0-9a-f]+)/m),
    sprite2Guid: extractGuid(text, /^\s*sprite2:\s*\{[^}]*guid:\s*([0-9a-f]+)/m),
    diff:        parseFloat(extractKey(text, /^\s*diff:\s*([-\d.eE+]+)$/m)),
    first:       extractKey(text, /^\s*firstLevels:\s*(\d+)$/m) === '1',
  };
}

function extractKey(text, regex) {
  const m = text.match(regex);
  if (!m) return null;
  return m[1].trim();
}

function extractGuid(text, regex) {
  const m = text.match(regex);
  if (!m) return null;
  return m[1];
}

// Parse a .png.meta file to get its guid.
export function parseMetaGuid(text) {
  const m = text.match(/^guid:\s*([0-9a-f]+)/m);
  return m ? m[1] : null;
}
