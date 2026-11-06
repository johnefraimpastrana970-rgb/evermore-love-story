import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/*
 * Author mode (`npm run author`): a tiny local API so author.html can save what you write.
 *   GET  /__author/content          -> src/content/authored.json
 *   PUT  /__author/content          -> write it (the previous version is kept in .author-backups/)
 *   POST /__author/photo?name=x.jpg -> save an image into public/assets/photos/authored/
 * Only active with `--mode author`, only answers requests from this computer, and never part of `vite build`.
 */

const MAX_JSON = 4 * 1024 * 1024;
const MAX_PHOTO = 15 * 1024 * 1024;
const LOCAL = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function readBody(req: import('node:http').IncomingMessage, max: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > max) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function writeAtomic(file: string, data: string | Buffer) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

export function authorPlugin(root: string): Plugin {
  const contentFile = path.join(root, 'src', 'content', 'authored.json');
  const photoDir = path.join(root, 'public', 'assets', 'photos', 'authored');
  const backupDir = path.join(root, '.author-backups');

  const backup = () => {
    if (!fs.existsSync(contentFile)) return;
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(contentFile, path.join(backupDir, `authored-${stamp}.json`));
    // Keep the 30 most recent.
    const old = fs.readdirSync(backupDir).filter((f) => f.startsWith('authored-')).sort().slice(0, -30);
    for (const f of old) fs.rmSync(path.join(backupDir, f));
  };

  return {
    name: 'evermore-author',
    apply: 'serve',
    // Saving content must not hot-reload the author page (or the game) mid-typing.
    handleHotUpdate(ctx) {
      const f = ctx.file.replace(/\\/g, '/');
      if (f.endsWith('/src/content/authored.json') || f.includes('/public/assets/photos/authored/')) return [];
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__author/')) return next();
        const send = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(body));
        };
        if (!LOCAL.has(req.socket.remoteAddress ?? '')) return send(403, { error: 'Author mode only works on this computer.' });
        const url = new URL(req.url, 'http://localhost');
        try {
          if (url.pathname === '/__author/content' && req.method === 'GET') {
            const text = fs.existsSync(contentFile) ? fs.readFileSync(contentFile, 'utf8') : '{}';
            return send(200, JSON.parse(text));
          }
          if (url.pathname === '/__author/content' && req.method === 'PUT') {
            const body = JSON.parse((await readBody(req, MAX_JSON)).toString('utf8'));
            if (!body || typeof body !== 'object' || Array.isArray(body)) return send(400, { error: 'Expected an object' });
            const next = JSON.stringify(body, null, 2) + '\n';
            const prev = fs.existsSync(contentFile) ? fs.readFileSync(contentFile, 'utf8') : '';
            if (next !== prev) { backup(); writeAtomic(contentFile, next); }
            return send(200, { ok: true });
          }
          if (url.pathname === '/__author/photo' && req.method === 'POST') {
            const raw = (url.searchParams.get('name') ?? 'photo.jpg').toLowerCase();
            const ext = path.extname(raw);
            if (!PHOTO_EXT.has(ext)) return send(400, { error: 'Use a JPG, PNG, WebP or GIF image.' });
            const base = path.basename(raw, ext).replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'photo';
            const data = await readBody(req, MAX_PHOTO);
            if (!data.length) return send(400, { error: 'Empty file' });
            fs.mkdirSync(photoDir, { recursive: true });
            let name = `${base}${ext}`;
            for (let i = 2; fs.existsSync(path.join(photoDir, name)); i++) {
              if (fs.readFileSync(path.join(photoDir, name)).equals(data)) break; // same picture: reuse it
              name = `${base}-${i}${ext}`;
            }
            if (!fs.existsSync(path.join(photoDir, name))) writeAtomic(path.join(photoDir, name), data);
            return send(200, { path: `assets/photos/authored/${name}` });
          }
          return send(404, { error: 'Unknown author request' });
        } catch (e) {
          return send(500, { error: e instanceof Error ? e.message : String(e) });
        }
      });
    },
  };
}
