// api/upload.js
// Vercel Serverless Function — no npm dependencies, uses UploadThing REST API directly
// POST /api/upload  (multipart/form-data with field "file") → { url, name, size, key }

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
    // Read raw body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);

    // Parse multipart
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) return res.status(400).json({ error: 'No multipart boundary found' });

    const { fileBuffer, fileName, mimeType } = parseMultipart(rawBody, boundaryMatch[1]);
    if (!fileBuffer) return res.status(400).json({ error: 'No file found in request' });

    // Step 1: Request upload URL from UploadThing
    const presignRes = await fetch('https://uploadthing.com/api/prepareUpload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-uploadthing-api-key': apiKey,
      },
      body: JSON.stringify({
        files: [{ name: fileName, size: fileBuffer.length, type: mimeType }],
        routeConfig: { blob: { maxFileSize: '256MB', maxFileCount: 1 } },
      }),
    });

    if (!presignRes.ok) {
      const err = await presignRes.text();
      console.error('prepareUpload error:', err);
      return res.status(502).json({ error: 'Failed to get upload URL', detail: err });
    }

    const presignData = await presignRes.json();
    const uploadData = presignData[0];

    // Step 2: Upload the file directly to the presigned URL (S3)
    const s3Res = await fetch(uploadData.url, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: fileBuffer,
    });

    if (!s3Res.ok) {
      const err = await s3Res.text();
      console.error('S3 upload error:', err);
      return res.status(502).json({ error: 'File upload to storage failed', detail: err });
    }

    // Step 3: Confirm the upload with UploadThing
    const confirmRes = await fetch('https://uploadthing.com/api/completeUpload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-uploadthing-api-key': apiKey,
      },
      body: JSON.stringify({ fileKey: uploadData.key }),
    });

    if (!confirmRes.ok) {
      const err = await confirmRes.text();
      console.error('completeUpload error:', err);
      return res.status(502).json({ error: 'Failed to confirm upload', detail: err });
    }

    return res.status(200).json({
      ok: true,
      name: fileName,
      size: fileBuffer.length,
      key: uploadData.key,
      url: `https://utfs.io/f/${uploadData.key}`,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};

// Simple multipart parser
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
    const fileBuffer = fileBody.slice(0, fileBody.length - 2); // strip trailing CRLF

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
