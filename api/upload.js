// api/upload.js — uses uploadthing SDK (Vercel installs it automatically)

module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { UTApi } = await import('uploadthing/server');
    const utapi = new UTApi();

    // Read raw multipart body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);

    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) return res.status(400).json({ error: 'No multipart boundary' });

    const { fileBuffer, fileName, mimeType } = parseMultipart(rawBody, boundaryMatch[1]);
    if (!fileBuffer) return res.status(400).json({ error: 'No file in request' });

    const file = new File([fileBuffer], fileName, { type: mimeType });
    const response = await utapi.uploadFiles([file]);
    const result = response[0];

    if (result.error) return res.status(500).json({ error: result.error.message });

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

function parseMultipart(body, boundary) {
  const delimiter = Buffer.from('--' + boundary);
  const parts = splitBuffer(body, delimiter);
  for (const part of parts) {
    if (!part || part.length < 4) continue;
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headerStr = part.slice(0, headerEnd).toString();
    if (!headerStr.includes('filename')) continue;
    const fileBody = part.slice(headerEnd + 4);
    const fileBuffer = fileBody.slice(0, fileBody.length - 2);
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
  let start = 0, pos = buf.indexOf(delimiter, start);
  while (pos !== -1) {
    parts.push(buf.slice(start, pos));
    start = pos + delimiter.length;
    pos = buf.indexOf(delimiter, start);
  }
  parts.push(buf.slice(start));
  return parts;
}
