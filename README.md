
# SmartScan X Pro

A local-first desktop file-relationship scanner with an **offline multi-user login system**, animated UI, and a bonus Game Center. Everything — scanning, matching, accounts, and data — runs and stays on the user's own PC. No internet connection or backend server is required at any point, before or after publishing.

## What's new in "Pro"

- **Full offline login system.** Each person creates a local ID (username) and password the first time they open the app. Their scans, projects, favorites and settings are private to that ID and stored only on that PC.
- **Persistent sessions.** "Keep me logged in" means the app auto-logs the same person back in next time, with no internet check.
- **Password recovery** via an optional local security question — no email, no server.
- **Backup / Restore Account** (Settings → Storage & Safety → Backup Account). This exports one JSON file containing the account + all its data. If the app is reinstalled, upgraded, or moved to another PC, the person opens the login screen, clicks **Restore from backup file**, and picks that file — their ID, password and data all come back exactly as they were. This is the piece that solves "what if the original build disappears": once installed, an app copy never depends on where it came from, and a backup file means a person's account survives even a full reinstall.
- Animated login/register/recovery screen, animated page transitions, animated result cards, animated sidebar account chip, and a small "loading" boot screen.
- All the original scanning, matching, Projects/History/Recovery/Duplicates/Storage panels, Settings, and the 3-game offline Game Center are unchanged and still fully local.

## How the accounts work (so you can explain it to your users)

- Accounts live in `smartscan-users.json` and each user's data lives in its own `smartscan-data-<ID>.json`, both inside the app's private per-PC data folder (Windows: `%APPDATA%\SmartScan X Pro\`).
- Passwords are never stored as plain text — they're salted and hashed (Node's `scrypt`) before being saved.
- Nothing is ever sent anywhere. There is no login server, so there is nothing for you to host, pay for, or keep running after you publish the app.
- Because of that, "by chance I delete the project" has no effect on anyone who already installed the app — their copy is fully self-contained. The only thing that can lose a user's data is losing that PC or its files, which is exactly what the Backup Account file is for.

## 1. Run it yourself (development mode)

1. Install **Node.js LTS** from https://nodejs.org/ (includes npm).
2. Extract this folder somewhere normal, e.g. `C:\SmartScan-X-Pro`.
3. Double-click **START-SMARTSCAN.bat** (Windows) — first run installs dependencies automatically, then opens the app.
   - On macOS/Linux, or from a terminal on any OS, instead run:
     ```
     npm install
     npm run dev
     ```
4. The first time the window opens you'll see the login screen — click **Create ID**, choose a username + password, and you're in.

## 2. Build a real installer (what you give to other people)

1. Make sure step 1 has been run at least once (so `node_modules` exists).
2. Double-click **BUILD-INSTALLER.bat**, or run:
   ```
   npm run dist
   ```
3. This uses `electron-builder` to produce a Windows installer (`.exe`, NSIS) inside the `release` folder. That single `.exe` is the file you share — anyone who runs it gets a normal Windows installer with Desktop + Start Menu shortcuts, and the app then runs completely offline.
4. To build for macOS or Linux instead, run `npx electron-builder --mac` or `npx electron-builder --linux` from a machine (or CI runner) of that OS — cross-building macOS installers from Windows/Linux isn't supported by Apple's tooling.

## 3. Publishing / distributing it

Since this is a fully offline desktop app (no server, no ongoing account to pay for), publishing just means putting the installer somewhere people can download it:

- **Simplest:** upload the `release/*.exe` to a GitHub Release, Google Drive, Dropbox, or your own website, and share the link.
- **GitHub Releases (recommended for updates):** create a repo, push this project, tag a release, and attach the built installer. `electron-builder` can also be configured with `publish` settings to push straight to GitHub Releases if you want built-in auto-update later.
- **Microsoft Store:** electron-builder supports an `appx` target if you want to submit to the Store instead of/alongside a direct-download `.exe`. That requires a (free or paid, depending on account type) Microsoft Partner Center developer account.
- **Code signing (optional but recommended):** an unsigned `.exe` will show a Windows SmartScreen warning on first run. A code-signing certificate (from Sectigo, DigiCert, etc.) removes that warning — add the certificate details under `build.win` in `package.json` (see electron-builder's code-signing docs).

## Project structure

```
SmartScan X Pro/
├─ electron/
│  ├─ main.cjs      # scanning engine + local accounts + file system access
│  └─ preload.cjs    # safe bridge between the UI and Electron
├─ src/
│  ├─ main.jsx        # main app UI (scanner, panels, games)
│  ├─ Auth.jsx        # login / register / recovery screen
│  └─ styles.css
├─ assets/            # app icon
├─ index.html
├─ vite.config.js
├─ package.json
├─ START-SMARTSCAN.bat     # one-click dev launcher (Windows)
└─ BUILD-INSTALLER.bat     # one-click installer build (Windows)
```

## Features (full list)

- Smart, explainable file-relationship scanning: filename similarity, folder/project match, type, extension, date proximity, exact SHA-1 duplicate detection, image perceptual hashing, matching image dimensions, and shared text keywords — combined into a 0–100% relationship score with human-readable reasons.
- Drag-and-drop or Browse to pick a seed file; add extra search folders.
- Image thumbnails and an in-app preview (images, video, PDF).
- Projects (saved scan collections), History (auto-saved past scans), Favorites, a Duplicates view, and a Recycle Bin Recovery scanner.
- CSV/JSON report export.
- Deep theming: 5 themes, custom accent color, rounded-corner style, animation speed, glass panels, animated glow.
- Offline multi-user accounts with local-only login, password recovery, and one-file backup/restore.
- Offline Game Center: Ragdoll Archer, Neon Snake, Memory Match — full-screen supported.
- 100% local-first: no telemetry, no uploads, no account server.

## Supabase cloud sync

This build is connected to the SmartScan Supabase project. Each local SmartScan account syncs its app data (history, favorites, projects, settings and profile) to `public.smartscan_data` using the account ID as the row key. Local storage remains the primary fallback, so the app continues to work when offline.

The app uses the Supabase publishable key only; no service-role/secret key is embedded. The database already uses `x-client-id` RLS policies for the `smartscan_data` table.
=======
# Smart-Sccaner
>>>>>>> c7588b1b920a4e81983c84562644fe0f33717e62
