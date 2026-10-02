import { useState, useEffect } from 'react';
const api = async (p, o = {}, t) => {
  const r = await fetch('/api' + p, { ...o, headers: { 'Content-Type': 'application/json', ...(t && { Authorization: 'Bearer ' + t }) }, body: o.body && JSON.stringify(o.body) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Erreur'); return d;
};
const KINDS = ['Vente', 'Location'], TYPES = ['Appartement', 'Villa', 'Terrain', 'Bureau'], STATUS = ['Disponible', 'Vendu', 'Loué'];
const price = l => l.price.toLocaleString('fr-FR') + ' TND' + (l.kind === 'Location' ? ' / mois' : '');
const go = p => { location.hash = p; window.scrollTo(0, 0); };
const useHash = () => { const [h, setH] = useState(location.hash.slice(1) || '/'); useEffect(() => { const f = () => setH(location.hash.slice(1) || '/'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []); return h; };

function Art({ l, cls }) {
  const h = (l.id * 47) % 360, c = `hsl(${h} 45% 45%)`, c2 = `hsl(${h} 45% 70%)`;
  const S = { Appartement: <><rect x="70" y="25" width="100" height="95" fill={c} />{[0, 1, 2].flatMap(r => [0, 1, 2].map(k => <rect key={r * 3 + k} x={82 + k * 30} y={36 + r * 28} width="16" height="16" fill="#fff" opacity=".85" />))}</>, Villa: <><rect x="55" y="65" width="130" height="55" fill={c} /><path d="M45 68 L120 22 L195 68Z" fill={c2} /><rect x="108" y="88" width="24" height="32" fill="#fff" opacity=".85" /></>, Terrain: <>{[0, 1, 2, 3].map(i => <path key={i} d={`M${20 + i * 55} 120 L${70 + i * 55} 78`} stroke={c} strokeWidth="6" />)}<rect x="20" y="108" width="200" height="12" fill={c2} /></>, Bureau: <><rect x="85" y="14" width="70" height="106" fill={c} />{[0, 1, 2, 3].map(r => <rect key={r} x="97" y={26 + r * 22} width="46" height="10" fill="#fff" opacity=".85" />)}</> };
  return <svg className={cls} viewBox="0 0 240 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label={l.type}><rect width="240" height="150" fill={`hsl(${h} 40% 90%)`} /><rect y="120" width="240" height="30" fill={c2} opacity=".5" />{S[l.type]}</svg>;
}
const Pic = ({ l, cls = 'ph', onClick }) => l.photos?.length ? <img className={cls} src={l.photos[0]} alt={l.title} onClick={onClick} /> : <div onClick={onClick}><Art l={l} cls={cls} /></div>;

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('dn') || 'null')), [msg, setMsg] = useState(''), parts = useHash().split('/').filter(Boolean), t = user?.token;
  const flash = m => { setMsg(m); setTimeout(() => setMsg(''), 3500); };
  const login = u => { localStorage.setItem('dn', JSON.stringify(u)); setUser(u); go('/'); };
  const p = { user, t, flash };
  return (<><header><h1 onClick={() => go('/')}>Darna<span>.</span></h1><nav>{user && <button onClick={() => go('/favs')}>Favoris</button>}{user && <button onClick={() => go('/mine')}>Mes annonces</button>}<button className="az" onClick={() => go(user ? '/new' : '/login')}>Déposer une annonce</button>
    {user ? <button onClick={() => { localStorage.removeItem('dn'); setUser(null); go('/'); }}>Déconnexion ({user.name})</button> : <button onClick={() => go('/login')}>Connexion</button>}</nav></header>
    <main>{parts[0] === 'ad' ? <Ad {...p} id={parts[1]} /> : parts[0] === 'login' ? <Auth onDone={login} flash={flash} /> : parts[0] === 'mine' ? (user ? <Mine {...p} /> : <Auth onDone={login} flash={flash} />) : parts[0] === 'new' ? (user ? <New {...p} /> : <Auth onDone={login} flash={flash} />) : parts[0] === 'favs' ? (user ? <Favs {...p} /> : <Auth onDone={login} flash={flash} />) : <Home {...p} />}</main>
    {msg && <div className="toast" role="status">{msg}</div>}</>);
}

function Card({ l, user, t, flash, onFav }) {
  const [fav, setFav] = useState(!!l.fav);
  const toggle = async () => { if (!user) return go('/login'); try { const r = await api('/favorites/' + l.id, { method: 'POST' }, t); setFav(r.fav); onFav?.(); } catch (e) { flash(e.message); } };
  return (<article className="card"><Pic l={l} onClick={() => go('/ad/' + l.id)} /><span className="badge">{l.kind}</span><button className="heart" aria-pressed={fav} aria-label="Ajouter aux favoris" onClick={toggle}>{fav ? '♥' : '♡'}</button>
    <div className="b"><span className="price">{price(l)}</span><h3 onClick={() => go('/ad/' + l.id)}>{l.title}</h3><span className="meta">{l.city} · {l.surface} m²{l.rooms > 0 && ` · ${l.rooms} ch.`}</span></div></article>);
}

function Home(p) {
  const [f, setF] = useState({ kind: '', type: '', city: '', min: '', max: '', rooms: '', sort: '' }), [page, setPage] = useState(1), [cities, setCities] = useState([]), [data, setData] = useState(null), set = k => e => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  useEffect(() => { api('/cities').then(setCities).catch(() => {}); }, []);
  useEffect(() => { setData(null); const id = setTimeout(() => api('/listings?' + new URLSearchParams({ ...f, page }), {}, p.t).then(setData).catch(() => setData({ items: [], pages: 1, total: 0 })), 250); return () => clearTimeout(id); }, [f, page]);
  return (<><h2>Trouvez votre bien</h2><div className="tabs">{['', ...KINDS].map(k => <button key={k} aria-pressed={f.kind === k} onClick={() => { setF({ ...f, kind: k }); setPage(1); }}>{k || 'Tout'}</button>)}</div>
    <div className="filters"><select value={f.type} onChange={set('type')} aria-label="Type"><option value="">Tous types</option>{TYPES.map(x => <option key={x}>{x}</option>)}</select><select value={f.city} onChange={set('city')} aria-label="Ville"><option value="">Toutes villes</option>{cities.map(c => <option key={c}>{c}</option>)}</select>
      <input type="number" placeholder="Prix min" value={f.min} onChange={set('min')} /><input type="number" placeholder="Prix max" value={f.max} onChange={set('max')} /><select value={f.rooms} onChange={set('rooms')} aria-label="Chambres"><option value="">Chambres</option>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}+</option>)}</select>
      <select value={f.sort} onChange={set('sort')} aria-label="Tri"><option value="">Plus récentes</option><option value="price_asc">Prix croissant</option><option value="price_desc">Prix décroissant</option></select></div>
    {!data ? <p className="muted">Chargement…</p> : <><p className="muted">{data.total} annonce{data.total > 1 ? 's' : ''}</p>{!data.items.length && <p className="muted">Aucune annonce ne correspond à ces critères.</p>}
      <div className="grid">{data.items.map(l => <Card key={l.id} l={l} {...p} />)}</div>
      {data.pages > 1 && <div className="pager"><button className="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</button><span className="muted">Page {page} / {data.pages}</span><button className="ghost" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Suivant</button></div>}</>}</>);
}

function Ad({ id, t, flash }) {
  const [l, setL] = useState(null), [i, setI] = useState(0), [f, setF] = useState({ name: '', phone: '', message: '' }), [err, setErr] = useState(''), [sent, setSent] = useState(false);
  useEffect(() => { api('/listings/' + id, {}, t).then(setL).catch(e => setErr(e.message)); }, [id]);
  if (err) return <p className="muted">{err}</p>; if (!l) return <p className="muted">Chargement…</p>;
  const send = async () => { try { await api(`/listings/${l.id}/inquiries`, { method: 'POST', body: f }); setSent(true); } catch (e) { flash(e.message); } };
  return (<><button className="link" onClick={() => go('/')}>← Toutes les annonces</button><div className="two" style={{ marginTop: '.6rem' }}><div>{l.photos.length ? <><img className="big" src={l.photos[i]} alt={l.title} /><div className="thumbs">{l.photos.map((p, k) => <img key={p} src={p} alt={`Photo ${k + 1}`} onClick={() => setI(k)} />)}</div></> : <Art l={l} cls="big" />}
    <h2 style={{ marginTop: '1rem' }}>{l.title}</h2><p className="meta">{l.type} · {l.city} · {l.surface} m²{l.rooms > 0 && ` · ${l.rooms} chambre${l.rooms > 1 ? 's' : ''}`} · {l.status}</p><div className="panel"><p style={{ margin: 0 }}>{l.description}</p></div></div>
    <aside className="panel form" style={{ alignSelf: 'start' }}><span className="price">{price(l)}</span><span className="muted">Annonce de {l.owner}</span>{l.status !== 'Disponible' ? <b>Ce bien n’est plus disponible ({l.status}).</b> : sent ? <b role="status">Message envoyé. Le propriétaire vous rappellera.</b> : <><input placeholder="Votre nom" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /><input placeholder="Téléphone" inputMode="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /><textarea placeholder="Votre message" value={f.message} onChange={e => setF({ ...f, message: e.target.value })} /><button className="az" onClick={send}>Contacter le propriétaire</button></>}</aside></div></>);
}

function Auth({ onDone, flash }) {
  const [reg, setReg] = useState(false), [f, setF] = useState({ name: '', email: '', password: '', phone: '' }), set = k => e => setF({ ...f, [k]: e.target.value });
  const go2 = async () => { try { onDone(await api(reg ? '/auth/register' : '/auth/login', { method: 'POST', body: f })); } catch (e) { flash(e.message); } };
  return (<div className="panel form" style={{ maxWidth: 420, margin: 'auto' }}><h2>{reg ? 'Créer un compte' : 'Connexion'}</h2>{reg && <><input placeholder="Nom" value={f.name} onChange={set('name')} /><input placeholder="Téléphone (optionnel)" value={f.phone} onChange={set('phone')} /></>}
    <input placeholder="Email" type="email" value={f.email} onChange={set('email')} /><input placeholder="Mot de passe" type="password" value={f.password} onChange={set('password')} /><button className="az" onClick={go2}>{reg ? 'Créer mon compte' : 'Se connecter'}</button><button className="ghost" onClick={() => setReg(!reg)}>{reg ? 'J’ai déjà un compte' : 'Créer un compte'}</button><span className="muted">Démo : owner@darna.tn / owner123</span></div>);
}

function Favs(p) {
  const [list, setList] = useState(null), load = () => api('/favorites', {}, p.t).then(setList).catch(e => p.flash(e.message)); useEffect(() => { load(); }, []);
  if (!list) return <p className="muted">Chargement…</p>;
  return (<><h2>Mes favoris</h2>{!list.length && <p className="muted">Aucun favori. Cliquez sur le cœur d’une annonce pour l’enregistrer.</p>}<div className="grid">{list.map(l => <Card key={l.id} l={l} {...p} onFav={load} />)}</div></>);
}

function Mine({ t, flash }) {
  const [list, setList] = useState(null), [inq, setInq] = useState([]), load = () => { api('/listings/mine', {}, t).then(setList).catch(e => flash(e.message)); api('/inquiries/mine', {}, t).then(setInq).catch(() => {}); }; useEffect(() => { load(); }, []);
  const act = async (fn, m) => { try { await fn(); if (m) flash(m); load(); } catch (e) { flash(e.message); } };
  if (!list) return <p className="muted">Chargement…</p>;
  return (<><div className="row"><h2>Mes annonces</h2><button className="az" onClick={() => go('/new')}>Nouvelle annonce</button></div>{!list.length && <p className="muted">Vous n’avez pas encore d’annonce.</p>}
    {list.map(l => <div className="panel row" key={l.id}><span><b>{l.title}</b><br /><span className="meta">{price(l)} · {l.city} · {l.inquiries} demande{l.inquiries > 1 ? 's' : ''}</span></span>
      <span><select style={{ width: 'auto' }} value={l.status} onChange={e => act(() => api('/listings/' + l.id, { method: 'PATCH', body: { status: e.target.value } }, t), 'Statut mis à jour')} aria-label="Statut">{STATUS.map(s => <option key={s}>{s}</option>)}</select>
        <button className="link" onClick={() => confirm('Supprimer cette annonce ?') && act(() => api('/listings/' + l.id, { method: 'DELETE' }, t), 'Annonce supprimée')}>Supprimer</button></span></div>)}
    <h2 style={{ marginTop: '1.5rem' }}>Demandes reçues</h2>{!inq.length && <p className="muted">Aucune demande pour l’instant.</p>}{inq.map(i => <div className="panel" key={i.id}><b>{i.name}</b> · {i.phone}<br /><span className="meta">À propos de « {i.title} »</span><p style={{ margin: '.4rem 0 0' }}>{i.message}</p></div>)}</>);
}

function New({ t, flash }) {
  const [f, setF] = useState({ title: '', kind: 'Vente', type: 'Appartement', city: '', price: '', rooms: '', surface: '', description: '' }), [photos, setPhotos] = useState([]), set = k => e => setF({ ...f, [k]: e.target.value });
  const pick = e => [...e.target.files].slice(0, 4 - photos.length).forEach(file => {
    const img = new Image(), src = URL.createObjectURL(file);
    img.onload = () => { const r = Math.min(1, 1000 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = img.width * r; c.height = img.height * r; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); setPhotos(a => a.length < 4 ? [...a, c.toDataURL('image/jpeg', 0.8)] : a); URL.revokeObjectURL(src); };
    img.onerror = () => flash('Image illisible'); img.src = src;
  });
  const save = async () => { try { const r = await api('/listings', { method: 'POST', body: { ...f, photos } }, t); flash('Annonce publiée'); go('/ad/' + r.id); } catch (e) { flash(e.message); } };
  return (<div className="panel form" style={{ maxWidth: 640 }}><h2>Déposer une annonce</h2><input placeholder="Titre (ex : Appartement S+2 vue mer)" value={f.title} onChange={set('title')} />
    <div className="filters" style={{ margin: 0 }}><select value={f.kind} onChange={set('kind')}>{KINDS.map(x => <option key={x}>{x}</option>)}</select><select value={f.type} onChange={set('type')}>{TYPES.map(x => <option key={x}>{x}</option>)}</select><input placeholder="Ville" value={f.city} onChange={set('city')} /></div>
    <div className="filters" style={{ margin: 0 }}><input type="number" placeholder="Prix (TND)" value={f.price} onChange={set('price')} /><input type="number" placeholder="Chambres" value={f.rooms} onChange={set('rooms')} /><input type="number" placeholder="Surface (m²)" value={f.surface} onChange={set('surface')} /></div>
    <textarea placeholder="Description (20 caractères min)" value={f.description} onChange={set('description')} />
    <div><input type="file" accept="image/*" multiple onChange={pick} disabled={photos.length >= 4} aria-label="Photos" /><div className="thumbs">{photos.map((p, i) => <img key={i} src={p} alt={`Photo ${i + 1}`} onClick={() => setPhotos(photos.filter((_, k) => k !== i))} title="Cliquer pour retirer" />)}</div><span className="muted">{photos.length}/4 photos · cliquez sur une miniature pour la retirer</span></div>
    <button className="az" onClick={save}>Publier l’annonce</button></div>);
}
