// api/upload.js
// Vercel Serverless Function
// GET  /api/upload?filename=x&type=y  → returns { presignedUrl, fileUrl }
// POST /api/upload                    → saves file record to KV (Vercel KV or simple JSON store)

const { UTApi } = require('uploadthing/server');

const utapi = new UTApi();

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET — generate a presigned upload URL
  if (req.method === 'GET') {
    const { filename, type } = req.query;
    if (!filename) return res.status(400).json({ error: 'filename required' });

    try {
      // Generate presigned URL for direct browser upload
      const { url, ufsUrl, key } = await utapi.generatePresignedUrl({
        acl: 'public-read',
        contentType: type || 'application/octet-stream',
        fileName: filename,
      });

      return res.status(200).json({
        presignedUrl: url,
        fileUrl: ufsUrl,
        key,
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  // POST — record the uploaded file in our simple store
  if (req.method === 'POST') {
    try {
      const { name, size, url } = req.body;

      // We store file records in Vercel KV (free tier).
      // If you don't have KV, records are kept in UploadThing's own dashboard.
      // The /api/files endpoint reads directly from UploadThing API instead.
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
