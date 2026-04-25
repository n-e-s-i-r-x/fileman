// api/upload.js
// Vercel Serverless Function
// POST /api/upload  (multipart/form-data with field "file") → { url, name, size, key }

const { UTApi } = require('uploadthing/server');

const utapi = new UTApi();

// We need to parse multipart manually — use Vercel's built-in body parsing disabled
export const config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Read raw body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);

    // Parse content-type to get boundary
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) return res.status(400).json({ error: 'No multipart boundary found' });

    const boundary = boundaryMatch[1];
    const { fileBuffer, fileName, mimeType } = parseMultipart(rawBody, boundary);

    if (!fileBuffer) return res.status(400).json({ error: 'No file found in request' });

    // Create a File object from the buffer
    const file = new File([fileBuffer], fileName, { type: mimeType });

    // Upload to UploadThing
    const response = await utapi.uploadFiles([file]);
    const result = response[0];

    if (result.error) {
      console.error('UploadThing error:', result.error);
      return res.status(500).json({ error: result.error.message });
    }

    return res.status(200).json({
      ok: true,
      name: result.data.name,
      size: result.data.size,
      key: result.data.key,
      url: result.data.url,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};

// Simple multipart parser
function parseMultipart(body, boundary) {
  const boundaryBuffer = Buffer.from('--' + boundary);
  const parts = splitBuffer(body, boundaryBuffer);

  for (const part of parts) {
    if (!part || part.length < 4) continue;

    // Find the double CRLF that separates headers from body
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headerStr = part.slice(0, headerEnd).toString();
    const fileBody = part.slice(headerEnd + 4);

    // Strip trailing CRLF
    const fileBuffer = fileBody.slice(0, fileBody.length - 2);

    if (!headerStr.includes('filename')) continue;

    const nameMatch = headerStr.match(/filename="([^"]+)"/);
    const typeMatch = headerStr.match(/Content-Type: ([^\r\n]+)/);

    return {
      fileBuffer,
      fileName: nameMatch ? nameMatch[1] : 'upload',
      mimeType: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
    };
  }
  return { fileBuffer: null, fileName: null, mimeType: null };
}

function splitBuffer(buf, delimiter) {
  const parts = [];
  let start = 0;
  let pos = buf.indexOf(delimiter, start);
  while (pos !== -1) {
    parts.push(buf.slice(start, pos));
    start = pos + delimiter.length;
    pos = buf.indexOf(delimiter, start);
  }
  parts.push(buf.slice(start));
  return parts;
}
