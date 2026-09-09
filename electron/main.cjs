const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  nativeImage
} = require('electron');

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let win = null;
let activeUserId = null;


/* =========================================================
   FILE TYPES
   ========================================================= */

const IMAGE = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
  '.avif',
  '.heic'
]);

const VIDEO = new Set([
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.m4v',
  '.wmv',
  '.flv'
]);

const AUDIO = new Set([
  '.mp3',
  '.wav',
  '.flac',
  '.aac',
  '.ogg',
  '.m4a'
]);

const DOC = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.rtf',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.csv',
  '.json'
]);

const DESIGN = new Set([
  '.psd',
  '.ai',
  '.xd',
  '.fig',
  '.sketch',
  '.svg',
  '.eps',
  '.indd',
  '.afdesign',
  '.afphoto'
]);


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function kind(ext) {
  if (IMAGE.has(ext)) return 'Images';
  if (VIDEO.has(ext)) return 'Videos';
  if (AUDIO.has(ext)) return 'Audio';
  if (DOC.has(ext)) return 'Documents';
  if (DESIGN.has(ext)) return 'Design';

  return 'Other';
}


function statSafe(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}


function normalize(value = '') {
  return value
    .toLowerCase()
    .replace(/[_\-.()[\]{}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function tokens(value = '') {
  return [
    ...new Set(
      normalize(value)
        .split(' ')
        .filter(x => x.length > 1)
    )
  ];
}


function jaccard(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));

  if (!A.size || !B.size) return 0;

  let intersection = 0;

  for (const x of A) {
    if (B.has(x)) {
      intersection++;
    }
  }

  return intersection /
    (A.size + B.size - intersection);
}


function stem(filePath) {
  return normalize(
    path.basename(
      filePath,
      path.extname(filePath)
    )
  );
}


function dateScore(a, b) {
  const days =
    Math.abs(a - b) /
    86400000;

  return Math.max(
    0,
    1 - days / 45
  );
}


function hamming(a, b) {
  if (
    !a ||
    !b ||
    a.length !== b.length
  ) {
    return 0;
  }

  let n = 0;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      n++;
    }
  }

  return 1 - n / a.length;
}


/* =========================================================
   IMAGE HASH
   ========================================================= */

function averageHash(filePath) {

  try {

    const img =
      nativeImage.createFromPath(
        filePath
      );

    if (img.isEmpty()) {
      return null;
    }

    const size =
      img.getSize();

    if (
      !size.width ||
      !size.height
    ) {
      return null;
    }

    const small =
      img.resize({
        width: 16,
        height: 16,
        quality: 'fast'
      });

    const bitmap =
      small.toBitmap();

    if (!bitmap.length) {
      return null;
    }

    const values = [];

    for (
      let i = 0;
      i < bitmap.length;
      i += 4
    ) {

      values.push(
        bitmap[i] * 0.299 +
        bitmap[i + 1] * 0.587 +
        bitmap[i + 2] * 0.114
      );

    }

    const avg =
      values.reduce(
        (a, b) => a + b,
        0
      ) / values.length;

    return values
      .map(v => v >= avg ? '1' : '0')
      .join('');

  } catch {
    return null;
  }
}


/* =========================================================
   METADATA
   ========================================================= */

function metadata(filePath) {

  const st =
    statSafe(filePath);

  if (!st || !st.isFile()) {
    return null;
  }

  const ext =
    path.extname(filePath)
      .toLowerCase();

  let thumbnail = null;

  if (IMAGE.has(ext)) {

    try {

      const img =
        nativeImage.createFromPath(
          filePath
        );

      if (!img.isEmpty()) {

        const thumb =
          img.resize({
            width: 260,
            height: 180,
            quality: 'good'
          });

        thumbnail =
          thumb.toDataURL();
      }

    } catch {
      thumbnail = null;
    }
  }

  return {
    path: filePath,
    name: path.basename(filePath),
    ext,
    size: st.size,
    modified: st.mtimeMs,
    created: st.birthtimeMs,
    kind: kind(ext),
    thumbnail
  };
}


/* =========================================================
   WALK FOLDER
   ========================================================= */

function walk(
  root,
  limit = 5000,
  depth = 8
) {

  const output = [];

  function visit(
    current,
    currentDepth
  ) {

    if (
      output.length >= limit ||
      currentDepth > depth
    ) {
      return;
    }

    let entries;

    try {
      entries =
        fs.readdirSync(
          current,
          {
            withFileTypes: true
          }
        );
    } catch {
      return;
    }


    for (const entry of entries) {

      if (
        output.length >= limit
      ) {
        break;
      }

      const fullPath =
        path.join(
          current,
          entry.name
        );


      if (entry.isDirectory()) {

        visit(
          fullPath,
          currentDepth + 1
        );

        continue;
      }


      const st =
        statSafe(fullPath);

      if (!st) {
        continue;
      }


      const ext =
        path.extname(fullPath)
          .toLowerCase();


      output.push({
        path: fullPath,
        name: entry.name,
        size: st.size,
        mtimeMs: st.mtimeMs,
        ext,
        kind: kind(ext)
      });
    }
  }


  visit(root, 0);

  return output;
}


/* =========================================================
   SCAN
   ========================================================= */

async function scan(payload = {}) {

  const seedPath =
    payload.seedPath;

  if (!seedPath) {
    throw new Error(
      'No file selected.'
    );
  }

  const seed =
    metadata(seedPath);

  if (!seed) {
    throw new Error(
      'The selected file could not be read.'
    );
  }


  const locations =
    Array.isArray(payload.locations)
      ? payload.locations
      : [];


  const folders =
    locations.length
      ? locations
      : [
          path.dirname(seedPath)
        ];


  const files = [];


  for (const folder of folders) {

    if (!folder) {
      continue;
    }

    const st =
      statSafe(folder);

    if (!st || !st.isDirectory()) {
      continue;
    }

    files.push(
      ...walk(
        folder,
        5000,
        payload.deepScan ? 10 : 5
      )
    );
  }


  const unique =
    new Map();

  for (const file of files) {
    unique.set(
      file.path.toLowerCase(),
      file
    );
  }


  const all =
    [...unique.values()]
      .filter(
        x =>
          x.path.toLowerCase() !==
          seedPath.toLowerCase()
      );


  const seedStem =
    stem(seedPath);


  const seedHash =
    averageHash(seedPath);


  const results = [];


  for (const file of all) {

    let score = 0;

    const reasons = [];


    /* Name relationship */

    const nameScore =
      jaccard(
        seed.name,
        file.name
      );


    if (nameScore > 0) {

      score +=
        nameScore * 35;

      reasons.push(
        'similar filename'
      );
    }


    /* Same type */

    if (
      file.kind ===
      seed.kind
    ) {

      score += 15;

      reasons.push(
        'same file type'
      );
    }


    /* Folder */

    const seedFolder =
      path.dirname(seedPath);

    const fileFolder =
      path.dirname(file.path);


    if (
      seedFolder.toLowerCase() ===
      fileFolder.toLowerCase()
    ) {

      score += 15;

      reasons.push(
        'same folder'
      );
    }


    /* Date */

    const ds =
      dateScore(
        seed.modified,
        file.mtimeMs
      );


    if (ds > .6) {

      score +=
        ds * 10;

      reasons.push(
        'similar date'
      );
    }


    /* Exact duplicate */

    if (
      file.size ===
      seed.size
    ) {

      try {

        const a =
          crypto
            .createHash('sha1')
            .update(
              fs.readFileSync(
                seedPath
              )
            )
            .digest('hex');

        const b =
          crypto
            .createHash('sha1')
            .update(
              fs.readFileSync(
                file.path
              )
            )
            .digest('hex');


        if (a === b) {

          score = 100;

          reasons.push(
            'exact duplicate'
          );
        }

      } catch {
        // Ignore inaccessible files.
      }
    }


    /* Image similarity */

    if (
      seedHash &&
      IMAGE.has(seed.ext) &&
      IMAGE.has(file.ext)
    ) {

      const fileHash =
        averageHash(
          file.path
        );

      const sim =
        hamming(
          seedHash,
          fileHash
        );


      if (sim > .7) {

        score +=
          sim * 30;

        reasons.push(
          'similar image'
        );
      }
    }


    score =
      Math.max(
        0,
        Math.min(
          100,
          Math.round(score)
        )
      );


    if (
      score >=
      Number(
        payload.minScore ?? 18
      )
    ) {

      const info =
        metadata(file.path);


      results.push({
        ...file,
        ...info,
        relatedScore: score,
        matchReasons:
          [...new Set(reasons)]
      });
    }
  }


  results.sort(
    (a, b) =>
      b.relatedScore -
      a.relatedScore
  );


  return {
    seed,
    results
  };
}


/* =========================================================
   SUPABASE CLOUD SYNC
   ========================================================= */

const SUPABASE_URL = 'https://sdvwtpltzpjcvocbnybw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_r_3tdQCVxo1SWdHn32PNvQ_5FaKfIaP';

async function supabaseRequest(path, options = {}, clientId = '') {
  const headers = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    'Content-Type': 'application/json',
    ...(clientId ? { 'x-client-id': clientId } : {}),
    ...(options.headers || {})
  };
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(body?.message || body?.error || `Cloud sync failed (${res.status})`);
  return body;
}

async function cloudLoadData(clientId) {
  if (!clientId) return null;
  const rows = await supabaseRequest(
    `/rest/v1/smartscan_data?select=payload,updated_at&client_id=eq.${encodeURIComponent(clientId)}&limit=1`,
    { method: 'GET' },
    clientId
  );
  return rows?.[0] || null;
}

async function cloudSaveData(clientId, data) {
  if (!clientId) return false;
  const payload = { ...data, updatedAt: Date.now() };
  await supabaseRequest(
    '/rest/v1/smartscan_data?on_conflict=client_id',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ client_id: clientId, payload, updated_at: new Date().toISOString() })
    },
    clientId
  );
  return true;
}

async function syncCloudData(clientId) {
  try { return await cloudLoadData(clientId); }
  catch (error) { console.warn('SmartScan cloud load skipped:', error.message); return null; }
}

/* =========================================================
   USER DATABASE
   ========================================================= */

function usersFile() {

  return path.join(
    app.getPath('userData'),
    'smartscan-users.json'
  );
}


function loadUsers() {

  try {

    return JSON.parse(
      fs.readFileSync(
        usersFile(),
        'utf8'
      )
    );

  } catch {

    return {
      users: []
    };
  }
}


function saveUsers(db) {

  fs.mkdirSync(
    app.getPath('userData'),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    usersFile(),
    JSON.stringify(
      db,
      null,
      2
    ),
    'utf8'
  );
}


function makeId() {

  return crypto
    .randomBytes(6)
    .toString('hex')
    .toUpperCase();
}


function makeSalt() {

  return crypto
    .randomBytes(16)
    .toString('hex');
}


function hashSecret(
  secret,
  salt
) {

  return crypto
    .createHash('sha256')
    .update(
      `${salt}:${secret}`
    )
    .digest('hex');
}


function safeEqual(a, b) {

  if (
    typeof a !== 'string' ||
    typeof b !== 'string' ||
    a.length !== b.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(a),
    Buffer.from(b)
  );
}


function publicUser(user) {

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    guest: false
  };
}


function registerUser(payload = {}) {

  const username =
    String(
      payload.username || ''
    )
      .trim()
      .toLowerCase();

  const displayName =
    String(
      payload.displayName ||
      payload.username ||
      ''
    )
      .trim();

  const password =
    String(
      payload.password || ''
    );


  if (!username) {
    throw new Error(
      'Username is required.'
    );
  }

  if (password.length < 4) {
    throw new Error(
      'Password must be at least 4 characters.'
    );
  }


  const db =
    loadUsers();


  if (
    db.users.some(
      u =>
        u.username ===
        username
    )
  ) {

    throw new Error(
      'Username already exists.'
    );
  }


  const salt =
    makeSalt();


  const user = {
    id: makeId(),
    username,
    displayName:
      displayName || username,
    salt,
    hash:
      hashSecret(
        password,
        salt
      ),
    question:
      String(
        payload.question || ''
      ).trim() || null,
    answerHash:
      payload.answer
        ? hashSecret(
            String(
              payload.answer
            )
              .trim()
              .toLowerCase(),
            salt
          )
        : null,
    createdAt: Date.now()
  };


  db.users.push(user);

  saveUsers(db);

  return user;
}


function loginUser(payload = {}) {

  const db =
    loadUsers();


  const username =
    String(
      payload.username || ''
    )
      .trim()
      .toLowerCase();


  const user =
    db.users.find(
      u =>
        u.username === username ||
        u.id ===
          String(
            payload.username || ''
          )
            .trim()
            .toUpperCase()
    );


  if (!user) {
    throw new Error(
      'No account found with that ID/username on this PC.'
    );
  }


  if (
    !safeEqual(
      hashSecret(
        String(
          payload.password || ''
        ),
        user.salt
      ),
      user.hash
    )
  ) {

    throw new Error(
      'Incorrect password.'
    );
  }


  return user;
}


function resetPassword(
  payload = {}
) {

  if (
    !payload.newPassword ||
    payload.newPassword.length < 4
  ) {

    throw new Error(
      'New password must be at least 4 characters.'
    );
  }


  const db =
    loadUsers();


  const username =
    String(
      payload.username || ''
    )
      .trim()
      .toLowerCase();


  const user =
    db.users.find(
      u =>
        u.username === username ||
        u.id ===
          String(
            payload.username || ''
          )
            .trim()
            .toUpperCase()
    );


  if (
    !user ||
    !user.answerHash
  ) {

    throw new Error(
      'No recovery question set for that account.'
    );
  }


  const answerHash =
    hashSecret(
      String(
        payload.answer || ''
      )
        .trim()
        .toLowerCase(),
      user.salt
    );


  if (
    !safeEqual(
      answerHash,
      user.answerHash
    )
  ) {

    throw new Error(
      'That answer does not match.'
    );
  }


  user.hash =
    hashSecret(
      payload.newPassword,
      user.salt
    );


  saveUsers(db);

  return user;
}


/* =========================================================
   LOCAL DATA
   ========================================================= */

function dataFile(userId) {

  const d =
    app.getPath('userData');


  fs.mkdirSync(
    d,
    {
      recursive: true
    }
  );


  const uid =
    userId ||
    activeUserId;


  if (!uid) {

    return path.join(
      d,
      'smartscan-data.json'
    );
  }


  return path.join(
    d,
    `smartscan-data-${uid}.json`
  );
}


function loadData(userId) {

  try {

    return JSON.parse(
      fs.readFileSync(
        dataFile(userId),
        'utf8'
      )
    );

  } catch {

    return {
      history: [],
      favorites: [],
      collections: [],
      settings: {}
    };
  }
}


function saveData(
  data,
  userId
) {

  fs.writeFileSync(
    dataFile(userId),
    JSON.stringify(
      data,
      null,
      2
    ),
    'utf8'
  );
}


/* =========================================================
   SESSION
   ========================================================= */

function sessionFile() {

  return path.join(
    app.getPath('userData'),
    'smartscan-session.json'
  );
}


function saveSession(
  userId,
  remember
) {

  if (remember && userId) {

    fs.writeFileSync(
      sessionFile(),
      JSON.stringify({
        userId,
        at: Date.now()
      }),
      'utf8'
    );

  } else {

    try {
      fs.unlinkSync(
        sessionFile()
      );
    } catch {
      // Nothing to remove.
    }
  }
}


function readSession() {

  try {

    return JSON.parse(
      fs.readFileSync(
        sessionFile(),
        'utf8'
      )
    );

  } catch {

    return null;
  }
}


/* =========================================================
   WINDOW
   ========================================================= */

function createWindow() {

  win =
    new BrowserWindow({

      width: 1500,
      height: 950,

      minWidth: 1050,
      minHeight: 700,

      backgroundColor:
        '#080d1b',

      show: false,

      icon:
        path.join(
          __dirname,
          '../assets/smartscan-x.png'
        ),

      webPreferences: {

        preload:
          path.join(
            __dirname,
            'preload.cjs'
          ),

        contextIsolation: true,

        nodeIntegration: false,

        sandbox: false
      }
    });


  win.once(
    'ready-to-show',
    () => win.show()
  );


  if (app.isPackaged) {

    win.loadFile(
      path.join(
        __dirname,
        '../dist/index.html'
      )
    );

  } else {

    win.loadURL(
      process.env.SMARTSCAN_DEV_URL ||
      'http://127.0.0.1:5173/'
    );
  }
}


/* =========================================================
   ELECTRON APP
   ========================================================= */

app.whenReady().then(() => {


  /* =========================
     FILE PICKER
     ========================= */

  ipcMain.handle(
    'select-file',
    async () => {

      if (!win) {
        return null;
      }

      const result =
        await dialog.showOpenDialog(
          win,
          {
            title:
              'Select a file',

            properties: [
              'openFile'
            ],

            filters: [
              {
                name:
                  'All files',
                extensions: [
                  '*'
                ]
              }
            ]
          }
        );


      if (
        result.canceled ||
        !result.filePaths.length
      ) {

        return null;
      }


      return result.filePaths[0];
    }
  );


  /* =========================
     FOLDER PICKER
     ========================= */

  ipcMain.handle(
    'select-folder',
    async () => {

      if (!win) {
        return null;
      }

      const result =
        await dialog.showOpenDialog(
          win,
          {
            title:
              'Select a folder',

            properties: [
              'openDirectory'
            ]
          }
        );


      if (
        result.canceled ||
        !result.filePaths.length
      ) {

        return null;
      }


      return result.filePaths[0];
    }
  );


  /* =========================
     SCAN
     ========================= */

  ipcMain.handle(
    'scan',
    async (_, payload) =>
      scan(payload)
  );


  ipcMain.handle(
    'file-info',
    (_, filePath) =>
      metadata(filePath)
  );


  /* =========================
     WINDOWS FILE ACTIONS
     ========================= */

  ipcMain.handle(
    'open-path',
    async (_, filePath) => {

      if (!filePath) {
        return false;
      }

      return shell.openPath(
        filePath
      );
    }
  );


  ipcMain.handle(
    'show-folder',
    (_, filePath) => {

      if (filePath) {
        shell.showItemInFolder(
          filePath
        );
      }

      return true;
    }
  );


  ipcMain.handle(
    'rename-file',
    async (_, { filePath, newName }) => {

      try {

        if (!filePath || !newName) {
          return { ok: false, error: 'Missing file path or new name.' };
        }

        const dir = path.dirname(filePath);
        const oldExt = path.extname(filePath);
        const hasExt = path.extname(newName);

        const cleanName =
          (hasExt ? newName : newName + oldExt)
            .replace(/[\\/:*?"<>|]/g, '_')
            .trim();

        if (!cleanName) {
          return { ok: false, error: 'Invalid file name.' };
        }

        const newPath = path.join(dir, cleanName);

        if (newPath === filePath) {
          return { ok: true, newPath };
        }

        if (fs.existsSync(newPath)) {
          return { ok: false, error: 'A file with that name already exists.' };
        }

        fs.renameSync(filePath, newPath);

        return { ok: true, newPath };

      } catch (error) {

        return { ok: false, error: String(error.message || error) };
      }
    }
  );


  /* =========================
     LOCAL DATA
     ========================= */

  ipcMain.handle(
    'data-load',
    async () => {
      const local = loadData();
      const cloud = await syncCloudData(activeUserId);
      const cloudPayload = cloud?.payload;
      if (cloudPayload && Number(cloudPayload.updatedAt || 0) > Number(local.updatedAt || 0)) {
        try { saveData(cloudPayload); } catch {}
        return cloudPayload;
      }
      return local;
    }
  );


  ipcMain.handle(
    'data-save',
    async (_, data) => {
      const next = { ...(data || {}), updatedAt: Date.now() };
      saveData(next);
      if (activeUserId) {
        try { await cloudSaveData(activeUserId, next); }
        catch (error) { console.warn('SmartScan cloud save skipped:', error.message); }
      }
      return true;
    }
  );


  /* =========================
     AUTH
     ========================= */

  ipcMain.handle(
    'auth-register',
    (_, payload) => {

      try {

        const user =
          registerUser(
            payload
          );


        activeUserId =
          user.id;


        saveSession(
          user.id,
          !!payload.remember
        );


        return {
          ok: true,
          user:
            publicUser(user)
        };

      } catch (error) {

        return {
          ok: false,
          error:
            error.message
        };
      }
    }
  );


  ipcMain.handle(
    'auth-login',
    (_, payload) => {

      try {

        const user =
          loginUser(
            payload
          );


        activeUserId =
          user.id;


        saveSession(
          user.id,
          !!payload.remember
        );


        return {
          ok: true,
          user:
            publicUser(user)
        };

      } catch (error) {

        return {
          ok: false,
          error:
            error.message
        };
      }
    }
  );


  ipcMain.handle(
    'auth-logout',
    () => {

      activeUserId =
        null;

      saveSession(
        null,
        false
      );


      return {
        ok: true
      };
    }
  );


  ipcMain.handle(
    'auth-reset-password',
    (_, payload) => {

      try {

        const user =
          resetPassword(
            payload
          );


        return {
          ok: true,
          user:
            publicUser(user)
        };

      } catch (error) {

        return {
          ok: false,
          error:
            error.message
        };
      }
    }
  );


  ipcMain.handle(
    'auth-session',
    () => {

      const session =
        readSession();


      if (!session?.userId) {
        return {
          ok: false
        };
      }


      const db =
        loadUsers();


      const user =
        db.users.find(
          x =>
            x.id ===
            session.userId
        );


      if (!user) {
        return {
          ok: false
        };
      }


      activeUserId =
        user.id;


      return {
        ok: true,
        user:
          publicUser(user)
      };
    }
  );


  /* =========================
     EXPORT REPORT
     ========================= */

  ipcMain.handle(
    'export-report',
    async (_, rows) => {

      const result =
        await dialog.showSaveDialog(
          win,
          {
            defaultPath:
              'SmartScan-Report.csv',

            filters: [
              {
                name: 'CSV',
                extensions: ['csv']
              },
              {
                name: 'JSON',
                extensions: ['json']
              }
            ]
          }
        );


      if (result.canceled) {
        return null;
      }


      const rowsSafe =
        Array.isArray(rows)
          ? rows
          : [];


      if (
        result.filePath
          .toLowerCase()
          .endsWith('.json')
      ) {

        fs.writeFileSync(
          result.filePath,
          JSON.stringify(
            rowsSafe,
            null,
            2
          ),
          'utf8'
        );

      } else {

        const csv = [
          [
            'File',
            'Type',
            'Score',
            'Location',
            'Reasons'
          ],

          ...rowsSafe.map(
            x => [
              x.name,
              x.kind,
              x.relatedScore,
              x.path,
              (
                x.matchReasons || []
              ).join('; ')
            ]
          )
        ];


        fs.writeFileSync(
          result.filePath,
          csv
            .map(
              row =>
                row
                  .map(
                    value =>
                      `"${String(
                        value ?? ''
                      ).replaceAll(
                        '"',
                        '""'
                      )}"`
                  )
                  .join(',')
            )
            .join('\n'),
          'utf8'
        );
      }


      return result.filePath;
    }
  );


  /* =========================
     ACCOUNT BACKUP
     ========================= */

  ipcMain.handle(
    'account-export',
    async () => {

      if (!activeUserId) {

        return {
          ok: false,
          error:
            'Not logged in.'
        };
      }


      const db =
        loadUsers();


      const user =
        db.users.find(
          x =>
            x.id ===
            activeUserId
        );


      if (!user) {

        return {
          ok: false,
          error:
            'Account not found.'
        };
      }


      const data =
        loadData();


      const result =
        await dialog.showSaveDialog(
          win,
          {
            defaultPath:
              `SmartScanX-Backup-${user.username}.json`,

            filters: [
              {
                name:
                  'SmartScan Backup',
                extensions:
                  ['json']
              }
            ]
          }
        );


      if (result.canceled) {
        return {
          ok: false
        };
      }


      fs.writeFileSync(
        result.filePath,
        JSON.stringify(
          {
            account: user,
            data
          },
          null,
          2
        ),
        'utf8'
      );


      return {
        ok: true,
        path:
          result.filePath
      };
    }
  );


  /* =========================
     ACCOUNT IMPORT
     ========================= */

  ipcMain.handle(
    'account-import',
    async () => {

      const result =
        await dialog.showOpenDialog(
          win,
          {
            properties: [
              'openFile'
            ],

            filters: [
              {
                name:
                  'SmartScan Backup',
                extensions:
                  ['json']
              }
            ]
          }
        );


      if (
        result.canceled ||
        !result.filePaths[0]
      ) {

        return {
          ok: false
        };
      }


      try {

        const bundle =
          JSON.parse(
            fs.readFileSync(
              result.filePaths[0],
              'utf8'
            )
          );


        if (!bundle.account?.id) {

          throw new Error(
            'This backup file is not a valid SmartScan X backup.'
          );
        }


        const db =
          loadUsers();


        const existing =
          db.users.find(
            x =>
              x.id ===
                bundle.account.id ||
              x.username ===
                bundle.account.username
          );


        if (existing) {

          Object.assign(
            existing,
            bundle.account
          );

        } else {

          db.users.push(
            bundle.account
          );
        }


        saveUsers(db);


        saveData(
          bundle.data || {
            history: [],
            favorites: [],
            collections: [],
            settings: {}
          },
          bundle.account.id
        );


        activeUserId =
          bundle.account.id;


        saveSession(
          bundle.account.id,
          true
        );


        return {
          ok: true,
          user:
            publicUser(
              bundle.account
            )
        };

      } catch (error) {

        return {
          ok: false,
          error:
            error.message ||
            'Could not read that backup file.'
        };
      }
    }
  );


  /* =========================
     INSTALL
     ========================= */

  ipcMain.handle(
    'install-app',
    () => ({
      packaged:
        app.isPackaged,

      installer:
        path.join(
          process.cwd(),
          'release'
        )
    })
  );


  /* =========================
     RECOVERY
     ========================= */

  ipcMain.handle(
    'recovery-scan',
    () => {

      if (
        process.platform !==
        'win32'
      ) {
        return [];
      }


      const root =
        'C:\\$Recycle.Bin';


      if (
        !fs.existsSync(root)
      ) {
        return [];
      }


      return walk(
        root,
        500,
        4
      ).map(
        x => ({
          path: x.path,
          name:
            path.basename(
              x.path
            ),
          size: x.size,
          modified:
            x.mtimeMs,
          kind:
            kind(
              path.extname(
                x.path
              )
            )
        })
      );
    }
  );


  /* =========================
     START WINDOW
     ========================= */

  createWindow();


  app.on(
    'activate',
    () => {

      if (
        BrowserWindow
          .getAllWindows()
          .length === 0
      ) {

        createWindow();
      }
    }
  );
});


app.on(
  'window-all-closed',
  () => {

    if (
      process.platform !==
      'darwin'
    ) {
      app.quit();
    }
  }
);