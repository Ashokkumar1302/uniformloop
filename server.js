const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');
const SESSION_COOKIE = 'uniformloop_session';
const SESSION_DAYS = 7;
let writeQueue = Promise.resolve();

async function readData() {
  const text = await fs.readFile(DATA_FILE, 'utf8');
  const data = JSON.parse(text);
  for (const key of ['users', 'sessions', 'requests', 'listings']) {
    if (!Array.isArray(data[key])) data[key] = [];
  }
  return data;
}

async function writeData(data) {
  const temporary = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, DATA_FILE);
}

function updateData(change) {
  const operation = writeQueue.then(async () => {
    const data = await readData();
    const result = await change(data);
    await writeData(data);
    return result;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

function sendJson(res, status, value, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(value));
}

function fail(res, status, message) {
  sendJson(res, status, { error: message });
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 40_000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  }
  try { return body ? JSON.parse(body) : {}; }
  catch { throw Object.assign(new Error('Send valid JSON.'), { status: 400 }); }
}

function cookieValue(req, name) {
  const prefix = `${name}=`;
  const part = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : '';
}

function tokenDigest(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function currentUser(data, req) {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token) return null;
  const digest = tokenDigest(token);
  const session = data.sessions.find(entry => entry.tokenHash === digest && entry.expiresAt > Date.now());
  if (!session) return null;
  return data.users.find(user => user.id === session.userId) || null;
}

function sessionCookie(token, req) {
  const secure = req.socket.encrypted ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 24 * 60 * 60}${secure}`;
}

function clearSessionCookie(req) {
  const secure = req.socket.encrypted ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  return origin === `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
}

async function passwordRecord(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}

async function passwordMatches(password, record) {
  const actual = await scrypt(password, Buffer.from(record.salt, 'hex'), 64);
  const expected = Buffer.from(record.hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function newSession(data, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  data.sessions = data.sessions.filter(session => session.expiresAt > Date.now());
  data.sessions.push({
    tokenHash: tokenDigest(token),
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  });
  return token;
}

function publicUser(user) {
  return user ? { id: user.id, username: user.username, displayName: user.displayName } : null;
}

function publicListing(listing, user, requests) {
  const mine = !!user && listing.ownerId === user.id;
  return {
    id: listing.id,
    title: listing.title,
    type: listing.type,
    school: listing.school,
    grade: listing.grade,
    size: listing.size,
    condition: listing.condition,
    sharing: listing.sharing,
    price: listing.price,
    owner: mine ? 'You' : listing.ownerName,
    initial: mine ? 'Y' : (listing.ownerName || '?').slice(0, 1).toUpperCase(),
    isMine: mine,
    requestSent: !!user && requests.some(request => request.listingId === listing.id && request.userId === user.id),
    requestCount: requests.filter(request => request.listingId === listing.id).length,
    area: listing.area,
    distance: listing.distance,
    description: listing.description,
    icon: listing.icon,
    tone: listing.tone,
    created: listing.created
  };
}

function asError(res, error) {
  fail(res, error.status || 500, error.status ? error.message : 'The server could not complete that request.');
}

async function handleAuth(req, res, url) {
  if (!checkOrigin(req)) return fail(res, 403, 'Request origin was not allowed.');
  let body;
  try { body = await readBody(req); } catch (error) { return asError(res, error); }
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');

  try {
    if (url.pathname === '/api/auth/signup') {
      const displayName = String(body.displayName || '').trim();
      if (!/^[a-z0-9_]{3,24}$/.test(username)) return fail(res, 400, 'Username must be 3–24 characters: letters, numbers, or underscores.');
      if (displayName.length < 2 || displayName.length > 40) return fail(res, 400, 'Display name must be 2–40 characters.');
      if (password.length < 8 || password.length > 200) return fail(res, 400, 'Password must be at least 8 characters.');
      const credential = await passwordRecord(password);
      let token;
      let user;
      await updateData(data => {
        if (data.users.some(entry => entry.username === username)) throw Object.assign(new Error('That username is already taken.'), { status: 409 });
        user = { id: crypto.randomUUID(), username, displayName, passwordSalt: credential.salt, passwordHash: credential.hash, createdAt: new Date().toISOString() };
        data.users.push(user);
        token = newSession(data, user.id);
      });
      return sendJson(res, 201, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(token, req) });
    }

    if (url.pathname === '/api/auth/signin') {
      if (!username || !password) return fail(res, 400, 'Enter your username and password.');
      const data = await readData();
      const user = data.users.find(entry => entry.username === username);
      const valid = user && await passwordMatches(password, { salt: user.passwordSalt, hash: user.passwordHash });
      if (!valid) return fail(res, 401, 'Username or password is incorrect.');
      let token;
      await updateData(store => { token = newSession(store, user.id); });
      return sendJson(res, 200, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(token, req) });
    }

    if (url.pathname === '/api/auth/signout') {
      const token = cookieValue(req, SESSION_COOKIE);
      if (token) await updateData(data => { data.sessions = data.sessions.filter(entry => entry.tokenHash !== tokenDigest(token)); });
      return sendJson(res, 200, { user: null }, { 'Set-Cookie': clearSessionCookie(req) });
    }
  } catch (error) {
    return asError(res, error);
  }
  return false;
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/me') {
    const data = await readData();
    return sendJson(res, 200, { user: publicUser(currentUser(data, req)) });
  }

  if (req.method === 'GET' && url.pathname === '/api/listings') {
    const data = await readData();
    const user = currentUser(data, req);
    const listings = data.listings.map(item => publicListing(item, user, data.requests));
    return sendJson(res, 200, { listings });
  }

  if (req.method === 'GET' && url.pathname === '/api/stats') {
    const data = await readData();
    return sendJson(res, 200, {
      listings: data.listings.length,
      free: data.listings.filter(item => item.sharing === 'Free').length,
      requests: data.requests.length
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/listings') {
    if (!checkOrigin(req)) return fail(res, 403, 'Request origin was not allowed.');
    let body;
    try { body = await readBody(req); } catch (error) { return asError(res, error); }
    try {
      let created;
      await updateData(data => {
        const user = currentUser(data, req);
        if (!user) throw Object.assign(new Error('Sign in to add a listing.'), { status: 401 });
        const title = String(body.title || '').trim();
        const school = String(body.school || '').trim();
        const size = String(body.size || '').trim();
        const description = String(body.description || '').trim();
        const type = String(body.type || '');
        const grade = String(body.grade || '');
        const condition = String(body.condition || '');
        const sharingChoice = String(body.sharing || '');
        const allowedTypes = ['Uniform', 'Textbook', 'Sportswear', 'Supplies'];
        const allowedConditions = ['Like new', 'Very good', 'Good'];
        if (title.length < 3 || title.length > 70 || school.length < 2 || school.length > 60 || size.length < 1 || size.length > 20) {
          throw Object.assign(new Error('Add a title, school, and size to continue.'), { status: 400 });
        }
        if (!allowedTypes.includes(type) || !/^Grade [4-8]$|^Grades 4–6$|^Any grade$/.test(grade) || !allowedConditions.includes(condition)) {
          throw Object.assign(new Error('Choose a valid item type, grade, and condition.'), { status: 400 });
        }
        if (!['Free', 'Swap', 'For sale'].includes(sharingChoice)) throw Object.assign(new Error('Choose Free, Swap, or For sale.'), { status: 400 });
        const price = sharingChoice === 'For sale' ? Number(body.price) : 0;
        if (sharingChoice === 'For sale' && (!Number.isInteger(price) || price < 1 || price > 1000000)) {
          throw Object.assign(new Error('Enter a sale price between ₹1 and ₹10,00,000.'), { status: 400 });
        }
        const typeLook = { Uniform: ['👕', 'uniform'], Textbook: ['📗', 'book'], Sportswear: ['🎽', 'sports'], Supplies: ['🎒', 'supplies'] }[type];
        created = {
          id: crypto.randomUUID(), title, type, school, grade, size, condition,
          sharing: sharingChoice === 'For sale' ? `₹${price}` : sharingChoice,
          price, ownerId: user.id, ownerName: user.displayName,
          area: 'Pune', distance: 'Nearby', description: description.slice(0, 220) || 'A useful school essential, ready for another family.',
          icon: typeLook[0], tone: typeLook[1], created: Date.now()
        };
        data.listings.unshift(created);
      });
      const data = await readData();
      return sendJson(res, 201, { listing: publicListing(created, currentUser(data, req), data.requests) });
    } catch (error) {
      return asError(res, error);
    }
  }

  const requestMatch = url.pathname.match(/^\/api\/listings\/([^/]+)\/request$/);
  if (req.method === 'POST' && requestMatch) {
    if (!checkOrigin(req)) return fail(res, 403, 'Request origin was not allowed.');
    try {
      const listingId = decodeURIComponent(requestMatch[1]);
      let requestResult;
      await updateData(data => {
        const user = currentUser(data, req);
        if (!user) throw Object.assign(new Error('Sign in to request an item.'), { status: 401 });
        const listing = data.listings.find(entry => entry.id === listingId);
        if (!listing) throw Object.assign(new Error('This listing is no longer available.'), { status: 404 });
        if (listing.ownerId === user.id) throw Object.assign(new Error('You cannot request your own listing.'), { status: 400 });
        const existing = data.requests.find(entry => entry.listingId === listingId && entry.userId === user.id);
        if (existing) {
          requestResult = existing;
          return;
        }
        requestResult = { id: crypto.randomUUID(), listingId, userId: user.id, createdAt: new Date().toISOString() };
        data.requests.push(requestResult);
      });
      const data = await readData();
      return sendJson(res, 200, { request: requestResult, stats: { requests: data.requests.length } });
    } catch (error) {
      return asError(res, error);
    }
  }

  return false;
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const allowed = new Set(['index.html', 'app.js', 'styles.css', 'auth.css']);
  if (!allowed.has(requested)) return fail(res, 404, 'Not found.');
  try {
    const contents = await fs.readFile(path.join(ROOT, requested));
    const contentType = requested.endsWith('.html') ? 'text/html; charset=utf-8' : requested.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(contents);
  } catch {
    fail(res, 404, 'Not found.');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname.startsWith('/api/auth/')) {
    const handled = await handleAuth(req, res, url);
    if (handled !== false) return;
  }
  if (url.pathname.startsWith('/api/')) {
    try {
      const handled = await handleApi(req, res, url);
      if (handled !== false) return;
    } catch (error) {
      return asError(res, error);
    }
    return fail(res, 404, 'API route not found.');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'Method not allowed.');
  return serveStatic(req, res, url);
});

async function start() {
  try {
    await fs.access(DATA_FILE);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const seed = JSON.parse(await fs.readFile(path.join(ROOT, 'data.example.json'), 'utf8'));
    await writeData(seed);
  }
  server.listen(PORT, () => console.log(`UniformLoop is running at http://localhost:${PORT}`));
}

start().catch(error => {
  console.error('UniformLoop could not start:', error.message);
  process.exitCode = 1;
});
