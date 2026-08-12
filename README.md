# QHQ Portal Deployment Guide (Hostinger)

This app is a Vite + React SPA with WordPress API integration. Use this guide to produce a Hostinger-safe build with routing, CSS, images, and video working correctly in production.

## 1) Configure production environment

Use `.env.production` for your live domain values. You can copy from `.env.hostinger.example`.

Required keys:

```env
# Root deployment (https://your-domain.com)
VITE_PUBLIC_BASE_PATH=/

# If deployed in subfolder (https://your-domain.com/portal/)
# VITE_PUBLIC_BASE_PATH=/portal/

VITE_WP_SITE_URL=https://your-domain.com
VITE_WP_BASE_URL=https://your-domain.com/wp-json/app/v1
```

Notes:

- `VITE_PUBLIC_BASE_PATH` controls how bundled CSS/JS/media URLs are generated.
- Wrong `VITE_PUBLIC_BASE_PATH` is the most common reason for broken CSS or missing media on live domain.

## 2) Build for Hostinger

```bash
npm install
npm run build:hostinger
```

This script:

- Clears old `dist` output.
- Builds production assets.
- Ensures `.htaccess` is copied into `dist`.

## 3) Upload to Hostinger

Upload the full contents of `dist` to your target folder:

- Domain root: `public_html/`
- Subfolder deploy: `public_html/portal/`

Important:

- Remove old files in target folder before uploading new build to avoid stale hashed assets.
- Ensure `.htaccess` is present next to `index.html` after upload.

## 4) Verify live deployment

After upload, hard refresh browser (`Ctrl+F5`) and verify:

- CSS loads (no unstyled page).
- Hero video and poster load.
- Client-side routes (for example `/dashboard`) open directly without 404.
- Login/data requests hit your live WordPress API domain.

## 5) Routing support via .htaccess

`public/.htaccess` is included in build and handles:

- SPA fallback to `index.html` for React Router routes.
- Static file pass-through.
- Cache headers for assets and no-cache for `index.html`.

If deploying to subfolder, update `RewriteBase` inside `.htaccess` (for example `RewriteBase /portal/`).

## Local development

```bash
npm run dev
```
