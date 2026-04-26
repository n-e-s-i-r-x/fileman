// api/upload.js
// Vercel Serverless Function — zero dependencies, UploadThing REST API v6
// POST /api/upload (multipart/form-data, field "file") → { ok, url, name, size, key }

module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.UPLOADTHING_SECRET;
  if (!apiKey) return res.status(500).json({ error: 'UPLOADTHING_SECRET not set' });

  try {
    // 1. Read raw multipart body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);

    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) return res.status(400).json({ error: 'No multipart boundary' });

    const { fileBuffer, fileName, mimeType } = parseMultipart(rawBody, boundaryMatch[1]);
    if (!fileBuffer) return res.status(400).json({ error: 'No file in request' });

    // 2. Get presigned S3 URL from UploadThing
    const utRes = await fetch('https://api.uploadthing.com/v6/uploadFiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-uploadthing-api-key': apiKey,
      },
      body: JSON.stringify({
        files: [{ name: fileName, size: fileBuffer.length, type: mimeType }],
        acl: 'public-read',
        contentDisposition: 'inline',
      }),
    });

    if (!utRes.ok) {
      const err = await utRes.text();
      return res.status(502).json({ error: 'Failed to get presigned URL', detail: err });
    }

    const { data } = await utRes.json();
    const { url, fields, key } = data[0];

    // 3. Upload to S3 using the presigned POST fields
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append('file', new Blob([fileBuffer], { type: mimeType }), fileName);

    const s3Res = await fetch(url, { method: 'POST', body: form });
    if (!s3Res.ok) {
      const err = await s3Res.text();
      return res.status(502).json({ error: 'S3 upload failed', detail: err });
    }

    return res.status(200).json({
      ok: true,
      name: fileName,
      size: fileBuffer.length,
      key,
      url: `https://utfs.io/f/${key}`,
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
