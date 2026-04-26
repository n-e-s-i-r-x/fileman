// api/file.js
// Vercel Serverless Function — no npm dependencies, uses UploadThing REST API directly
// GET /api/file → returns { files: [...] }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.UPLOADTHING_SECRET;
  if (!apiKey) return res.status(500).json({ error: 'UPLOADTHING_SECRET not set' });

  try {
    const response = await fetch('https://api.uploadthing.com/v6/listFiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-uploadthing-api-key': apiKey,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('listFiles error:', err);
      return res.status(502).json({ error: 'Failed to list files', detail: err });
    }

    const data = await response.json();
    const files = (data.files || []).map((f) => ({
      key: f.key,
      name: f.name,
      size: f.size,
      url: `https://utfs.io/f/${f.key}`,
      uploadedAt: f.uploadedAt ? new Date(f.uploadedAt).toISOString() : null,
    }));

    files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return res.status(200).json({ files });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};
