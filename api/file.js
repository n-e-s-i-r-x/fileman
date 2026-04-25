// api/files.js
// Vercel Serverless Function
// GET /api/files → returns { files: [...] }

import { UTApi } from 'uploadthing/server';

const utapi = new UTApi();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { files } = await utapi.listFiles();

    const mapped = files.map((f) => ({
      key: f.key,
      name: f.name,
      size: f.size,
      url: `https://utfs.io/f/${f.key}`,
      uploadedAt: f.uploadedAt ? new Date(f.uploadedAt).toISOString() : null,
    }));

    // Newest first
    mapped.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return res.status(200).json({ files: mapped });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
