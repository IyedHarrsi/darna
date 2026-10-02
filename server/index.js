import express from 'express'; import cors from 'cors'; import bcrypt from 'bcryptjs'; import jwt from 'jsonwebtoken'; import fs from 'fs'; import path from 'path'; import { DatabaseSync } from 'node:sqlite';
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me', PORT = process.env.PORT || 5006, db = new DatabaseSync('data.db');
const KINDS = ['Vente', 'Location'], TYPES = ['Appartement', 'Villa', 'Terrain', 'Bureau'], STATUS = ['Disponible', 'Vendu', 'Loué'];
fs.mkdirSync('uploads', { recursive: true });
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, hash TEXT, phone TEXT);
CREATE TABLE IF NOT EXISTS listings(id INTEGER PRIMARY KEY, owner_id INTEGER, title TEXT, kind TEXT, type TEXT, city TEXT, price INTEGER, rooms INTEGER, surface INTEGER, description TEXT, photos TEXT DEFAULT '[]', status TEXT DEFAULT 'Disponible', created_at TEXT);
CREATE TABLE IF NOT EXISTS favorites(user_id INTEGER, listing_id INTEGER, PRIMARY KEY(user_id, listing_id));
CREATE TABLE IF NOT EXISTS inquiries(id INTEGER PRIMARY KEY, listing_id INTEGER, name TEXT, phone TEXT, message TEXT, created_at TEXT);`);
const run = (s, ...p) => db.prepare(s).run(...p), get = (s, ...p) => db.prepare(s).get(...p), all = (s, ...p) => db.prepare(s).all(...p);
if (!get('SELECT COUNT(*) c FROM users').c) {
  const o = run('INSERT INTO users(name,email,hash,phone) VALUES (?,?,?,?)', 'Karim Immobilier', 'owner@darna.tn', bcrypt.hashSync('owner123', 8), '22 123 456').lastInsertRowid;
  const L = [['Appartement S+2 vue mer', 'Vente', 'Appartement', 'Sousse', 285000, 2, 98], ['Villa avec piscine', 'Vente', 'Villa', 'Hammamet', 640000, 4, 260], ['Studio meublé centre-ville', 'Location', 'Appartement', 'Tunis', 900, 1, 38], ['Terrain constructible 500 m²', 'Vente', 'Terrain', 'Nabeul', 150000, 0, 500], ['Bureau open space', 'Location', 'Bureau', 'Tunis', 2200, 0, 120], ['Appartement S+3 neuf', 'Vente', 'Appartement', 'Monastir', 330000, 3, 125], ['Villa jumelée', 'Location', 'Villa', 'Sousse', 2400, 4, 210], ['Appartement S+1 proche plage', 'Location', 'Appartement', 'Hammamet', 750, 1, 55], ['Duplex avec terrasse', 'Vente', 'Appartement', 'Sfax', 410000, 3, 150], ['Local commercial', 'Location', 'Bureau', 'Sfax', 1600, 0, 80], ['Villa de plain-pied', 'Vente', 'Villa', 'Monastir', 520000, 5, 300], ['Appartement S+2 meublé', 'Location', 'Appartement', 'Sousse', 1100, 2, 85]];
  L.forEach(([t, k, ty, c, p, r, s], i) => run('INSERT INTO listings(owner_id,title,kind,type,city,price,rooms,surface,description,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', o, t, k, ty, c, p, r, s, `${ty} de ${s} m² à ${c}, en ${k === 'Vente' ? 'vente' : 'location'}. Bien entretenu, quartier calme et bien desservi, proche des commerces et des transports. Visite possible sur rendez-vous.`, new Date(Date.now() - i * 864e5).toISOString()));
}
const app = express(); app.use(cors(), express.json({ limit: '8mb' })); app.use('/uploads', express.static('uploads'));
const read = req => { try { return jwt.verify((req.headers.authorization || '').slice(7), SECRET); } catch { return null; } };
const auth = (req, res, next) => (req.user = read(req)) ? next() : res.status(401).json({ error: 'Connexion requise' });
const sign = u => ({ token: jwt.sign({ id: Number(u.id), name: u.name }, SECRET, { expiresIn: '7d' }), name: u.name, id: Number(u.id) });
const favSet = me => new Set(me ? all('SELECT listing_id FROM favorites WHERE user_id=?', me.id).map(f => f.listing_id) : []);
const fmt = (r, fav) => ({ ...r, photos: JSON.parse(r.photos || '[]'), ...(fav && { fav: fav.has(r.id) }) });
const own = (req, res) => { const l = get('SELECT * FROM listings WHERE id=? AND owner_id=?', +req.params.id, req.user.id); if (!l) res.status(404).json({ error: 'Annonce introuvable' }); return l; };
const rm = l => JSON.parse(l.photos || '[]').forEach(p => fs.rmSync(path.join('uploads', path.basename(p)), { force: true }));

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone = '' } = req.body;
  if (!name?.trim() || !/\S+@\S+\.\S+/.test(email || '') || (password || '').length < 6) return res.status(400).json({ error: 'Nom, email valide et mot de passe (6 caractères min) requis' });
  if (get('SELECT 1 FROM users WHERE email=?', email)) return res.status(409).json({ error: 'Cet email existe déjà' });
  res.json(sign({ id: run('INSERT INTO users(name,email,hash,phone) VALUES (?,?,?,?)', name.trim(), email, bcrypt.hashSync(password, 8), phone).lastInsertRowid, name: name.trim() }));
});
app.post('/api/auth/login', (req, res) => {
  const u = get('SELECT * FROM users WHERE email=?', req.body.email || '');
  if (!u || !bcrypt.compareSync(req.body.password || '', u.hash)) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  res.json(sign(u));
});
app.get('/api/cities', (_, res) => res.json(all("SELECT DISTINCT city FROM listings WHERE status='Disponible' ORDER BY city").map(r => r.city)));
app.get('/api/listings', (req, res) => {
  const { kind, type, city, min, max, rooms, sort } = req.query, page = Math.max(1, +req.query.page || 1), w = ["status='Disponible'"], p = [];
  if (KINDS.includes(kind)) { w.push('kind=?'); p.push(kind); } if (TYPES.includes(type)) { w.push('type=?'); p.push(type); } if (city) { w.push('city=?'); p.push(city); }
  if (+min > 0) { w.push('price>=?'); p.push(+min); } if (+max > 0) { w.push('price<=?'); p.push(+max); } if (+rooms > 0) { w.push('rooms>=?'); p.push(+rooms); }
  const order = { price_asc: 'price ASC', price_desc: 'price DESC' }[sort] || 'id DESC', total = get(`SELECT COUNT(*) c FROM listings WHERE ${w.join(' AND ')}`, ...p).c;
  const items = all(`SELECT * FROM listings WHERE ${w.join(' AND ')} ORDER BY ${order} LIMIT 9 OFFSET ?`, ...p, (page - 1) * 9), fav = favSet(read(req));
  res.json({ items: items.map(r => fmt(r, fav)), total, pages: Math.max(1, Math.ceil(total / 9)) });
});
app.get('/api/listings/mine', auth, (req, res) => res.json(all('SELECT l.*, (SELECT COUNT(*) FROM inquiries i WHERE i.listing_id=l.id) AS inquiries FROM listings l WHERE owner_id=? ORDER BY id DESC', req.user.id).map(r => fmt(r))));
app.get('/api/listings/:id', (req, res) => {
  const r = get('SELECT l.*, u.name AS owner FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=?', +req.params.id);
  if (!r) return res.status(404).json({ error: 'Annonce introuvable' }); res.json(fmt(r, favSet(read(req))));
});
app.post('/api/listings', auth, (req, res) => {
  const b = req.body, price = +b.price, rooms = +b.rooms || 0, surface = +b.surface, photos = Array.isArray(b.photos) ? b.photos : [];
  if ((b.title || '').trim().length < 5 || !KINDS.includes(b.kind) || !TYPES.includes(b.type) || !b.city?.trim() || !(price > 0) || !(surface > 0) || rooms < 0 || rooms > 20 || (b.description || '').trim().length < 20) return res.status(400).json({ error: 'Titre, type, ville, prix, surface et description (20 caractères min) requis' });
  if (photos.length > 4) return res.status(400).json({ error: '4 photos maximum' });
  const saved = [];
  for (const [i, ph] of photos.entries()) {
    const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(ph || ''); if (!m) return res.status(400).json({ error: 'Photo invalide (JPG, PNG ou WebP)' });
    const buf = Buffer.from(m[2], 'base64'); if (buf.length > 1.5e6) return res.status(413).json({ error: 'Photo trop lourde (1,5 Mo max)' });
    const f = `${Date.now()}-${i}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`; fs.writeFileSync(path.join('uploads', f), buf); saved.push('/uploads/' + f);
  }
  res.json({ id: Number(run('INSERT INTO listings(owner_id,title,kind,type,city,price,rooms,surface,description,photos,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', req.user.id, b.title.trim(), b.kind, b.type, b.city.trim(), price, rooms, surface, b.description.trim(), JSON.stringify(saved), new Date().toISOString()).lastInsertRowid) });
});
app.patch('/api/listings/:id', auth, (req, res) => {
  const l = own(req, res); if (!l) return;
  if (req.body.status !== undefined && !STATUS.includes(req.body.status)) return res.status(400).json({ error: 'Statut invalide' });
  run('UPDATE listings SET status=?, price=? WHERE id=?', req.body.status ?? l.status, +req.body.price > 0 ? +req.body.price : l.price, l.id); res.json({ ok: true });
});
app.delete('/api/listings/:id', auth, (req, res) => { const l = own(req, res); if (!l) return; rm(l); run('DELETE FROM favorites WHERE listing_id=?', l.id); run('DELETE FROM inquiries WHERE listing_id=?', l.id); run('DELETE FROM listings WHERE id=?', l.id); res.json({ ok: true }); });
app.post('/api/listings/:id/inquiries', (req, res) => {
  const { name, phone, message } = req.body, l = get('SELECT id FROM listings WHERE id=?', +req.params.id);
  if (!l) return res.status(404).json({ error: 'Annonce introuvable' });
  if ((name || '').trim().length < 2 || !/^\+?[0-9 ]{8,15}$/.test(phone || '') || (message || '').trim().length < 5) return res.status(400).json({ error: 'Nom, téléphone valide et message requis' });
  run('INSERT INTO inquiries(listing_id,name,phone,message,created_at) VALUES (?,?,?,?,?)', l.id, name.trim(), phone, message.trim().slice(0, 1000), new Date().toISOString()); res.json({ ok: true });
});
app.get('/api/inquiries/mine', auth, (req, res) => res.json(all('SELECT i.*, l.title FROM inquiries i JOIN listings l ON l.id=i.listing_id WHERE l.owner_id=? ORDER BY i.id DESC', req.user.id)));
app.post('/api/favorites/:id', auth, (req, res) => {
  if (!get('SELECT 1 FROM listings WHERE id=?', +req.params.id)) return res.status(404).json({ error: 'Annonce introuvable' });
  const has = get('SELECT 1 FROM favorites WHERE user_id=? AND listing_id=?', req.user.id, +req.params.id);
  has ? run('DELETE FROM favorites WHERE user_id=? AND listing_id=?', req.user.id, +req.params.id) : run('INSERT INTO favorites VALUES (?,?)', req.user.id, +req.params.id); res.json({ fav: !has });
});
app.get('/api/favorites', auth, (req, res) => res.json(all('SELECT l.* FROM listings l JOIN favorites f ON f.listing_id=l.id WHERE f.user_id=? ORDER BY l.id DESC', req.user.id).map(r => fmt(r, new Set([r.id])))));
app.listen(PORT, () => console.log('API sur http://localhost:' + PORT));
