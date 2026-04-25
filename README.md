# CLOUDROP — Personal File Cloud

Free personal file upload + shareable links. No dashboard headaches.

## Stack
- **Frontend**: `index.html` (plain HTML, zero dependencies)
- **Backend**: 2 Vercel serverless functions
- **Storage**: UploadThing (2 GB free)
- **Hosting**: Vercel (free tier)

---

## Setup (5 minutes)

### 1. Get UploadThing token
1. Go to https://uploadthing.com → sign in with GitHub
2. Click **Create App** → name it anything
3. Go to **API Keys** tab → copy your token

### 2. Push to GitHub
```bash
git init
git add .
git commit -m "cloudrop init"
gh repo create cloudrop --public --push
```

### 3. Deploy to Vercel
1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repo
3. Go to **Settings → Environment Variables** → add:
   ```
   UPLOADTHING_TOKEN = your_token_here
   ```
4. Click **Deploy**

### 4. Done!
Open your `*.vercel.app` URL. Upload files, share download links.

---

## Free limits
| Service | Free tier |
|---|---|
| UploadThing storage | 2 GB |
| UploadThing bandwidth | Unlimited |
| Vercel functions | 100 GB-hours/month |
| Vercel hosting | Free `*.vercel.app` domain |

## File structure
```
cloudrop/
├── index.html        ← frontend UI
├── api/
│   ├── upload.js     ← GET: presigned URL / POST: record file
│   └── files.js      ← GET: list all files
├── vercel.json       ← routing
└── package.json      ← dependencies
```
