// src/utils/xml.js
// Converts a plain JS object / array to well-formed XML.
// Escapes the five special XML characters in all string values.

const ESCAPE_MAP = {
  '&' : '&amp;',
  '<' : '&lt;',
  '>' : '&gt;',
  '"' : '&quot;',
  "'" : '&apos;',
};

function escapeXml(value) {
  if (value == null) return '';
  return String(value).replace(/[&<>"']/g, c => ESCAPE_MAP[c]);
}

/**
 * Converts a value to an XML string fragment.
 * Arrays become repeated <item> elements; objects become their keys as tags.
 */
function toXmlFragment(value, tag = 'item') {
  if (Array.isArray(value)) {
    return value.map(v => toXmlFragment(v, tag)).join('\n');
  }
  if (value !== null && typeof value === 'object') {
    const inner = Object.entries(value)
      .map(([k, v]) => toXmlFragment(v, k))
      .join('\n');
    return `<${tag}>\n${inner}\n</${tag}>`;
  }
  return `<${tag}>${escapeXml(value)}</${tag}>`;
}

/**
 * Builds a complete XML document string.
 *
 * @param {object}  options
 * @param {any}     options.data       – the payload (array or object)
 * @param {number}  options.rowCount   – number of rows
 * @param {number}  options.executionTimeMs
 * @param {string}  [options.root]     – root element tag (default 'response')
 * @param {string}  [options.itemTag]  – tag for each array item (default 'row')
 */
export function toXml({ data, rowCount, executionTimeMs, root = 'response', itemTag = 'row' }) {
  const meta = [
    `<rowCount>${rowCount}</rowCount>`,
    `<executionTimeMs>${executionTimeMs}</executionTimeMs>`,
  ].join('\n');

  let dataXml;
  if (Array.isArray(data)) {
    dataXml = `<data>\n${data.map(row => toXmlFragment(row, itemTag)).join('\n')}\n</data>`;
  } else {
    dataXml = `<data>\n${toXmlFragment(data, itemTag)}\n</data>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<${root}>\n${meta}\n${dataXml}\n</${root}>`;
}

/**
 * Express response helper: sends XML with correct Content-Type.
 */
export function sendXml(res, payload) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(toXml(payload));
}
