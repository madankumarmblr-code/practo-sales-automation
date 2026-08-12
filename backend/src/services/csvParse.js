/**
 * Minimal CSV parser (RFC4180-ish) with header row → objects.
 * Avoids adding an extra npm dependency for sheet sync.
 */
export function parseCsv(text, { columns = true, skip_empty_lines = true, trim = true } = {}) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(trim ? field.trim() : field);
    field = '';
  };
  const pushRow = () => {
    if (skip_empty_lines && row.every((c) => !c)) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  while (i < raw.length) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushField();
      pushRow();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length || row.length) {
    pushField();
    pushRow();
  }

  if (!columns) return rows;
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? '';
    });
    return obj;
  });
}
