# Lulu Centre — GoDaddy Deluxe setup

Production content, logo settings, enquiries and the admin account now use
MySQL. Admin uploads use `public/assets/uploads`, served through `/uploads/`.
The public design and image assets are retained. The walkthrough video uses
https://lulu-centre-2.onrender.com/assets/lulu_centre%20video.mp4
Keep that Render service online to serve the video. No MP4 is bundled. Database settings are
required in production; the server never silently falls back to local SQLite.

## 1. Preserve current Render changes before redeploying

Sign in to the CURRENT admin panel. In another tab in the same browser, open
the CURRENT website URL followed by `/api/admin/content`. Use the browser's
Save As command to save the response as `lulu-content-backup.json`.
This contains saved content, links and settings, not passwords or image bytes.

Copy old `data/uploads` files separately if you have access, or keep the
original images ready to reupload. Record existing enquiries separately;
the content JSON does not contain enquiries. Previously lost Render changes
cannot be recovered from the source ZIP, which contains no live database.

## 2. Create the Node.js app and connect its database

Choose **Deploy a Node.js app**. Upload this revised ZIP using the ZIP route
if offered, and attach the app to your Deluxe subscription. `package.json`
is already at the ZIP root with build/start scripts. Do not upload a real
`.env` or `node_modules`.

Use the app's **Database** panel to enable/connect managed MySQL. GoDaddy's
database settings are supplied through these variables. Retain automatically
injected values if present; otherwise enter the actual database details in
the app's environment/secrets settings:

| Variable | Value |
| --- | --- |
| `DB_HOST` | GoDaddy managed MySQL host |
| `DB_PORT` | GoDaddy managed MySQL port, normally 3306 |
| `DB_NAME` | Database name |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |

Do not assume a cPanel database's `localhost` also works inside the managed
Node.js app. The user must have table creation and read/write permissions.
The app creates `lulu_content`, `lulu_enquiries` and `lulu_admin` automatically.

## 3. Configure environment variables

Add these in the app's secrets/environment settings:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `STORAGE_DRIVER` | `mysql` |
| `APP_ORIGIN` | Exact app HTTPS URL, with no trailing slash |
| `TRUST_PROXY` | `1` when behind GoDaddy's single trusted reverse proxy |
| `UPLOADS_DIR` | `./public/assets/uploads` |
| `ADMIN_USERNAME` | Your chosen username, 3–80 letters/numbers/underscores/dots/hyphens |
| `ADMIN_PASSWORD` | Your own strong password, 12–256 characters |

Use the preview URL while testing, then set the published variant to the
actual live HTTPS domain. `PORT` is supplied by GoDaddy; do not override it.
Keep credentials private and out of the ZIP. Restart after saving settings.

Open `/health`. Success is `{"ok":true,"storage":"mysql"}`. Then visit
`/admin/` and sign in with your chosen account. Startup credentials seed only
the first account; later admin password changes stay in MySQL across restarts.
You can remove `ADMIN_PASSWORD` after the first account has been created.

If startup fails, inspect Runtime Logs. Missing `DB_*` means configuration is
incomplete; connection/access errors mean credentials, host or permissions
need checking. Do not switch to SQLite to bypass this on managed hosting.

## 4. Restore content and check persistence

In the new admin panel, open **Logo & email settings**, choose **Restore content
backup**, select the old JSON and confirm. Copy old uploads into
`public/assets/uploads` with their original filenames, or upload the images
again in the editor and save their new paths. Original bundled images are
already included.

Before opening the website to visitors:

1. Save a recognisable text change and a test image; check the public page.
2. Restart the SAME app, sign in again and confirm the text and image remain.
3. Redeploy the SAME app and confirm both remain again.
4. Check the published variant's secrets and database too. Preview and publish
   may use different settings/databases; restore into the intended live DB if
   necessary. Set `APP_ORIGIN` to the live domain and edit the live admin.
5. Submit a test leasing enquiry and check the persistent admin inbox.

Restarts sign admins out because sessions are in memory; saved content,
enquiries and account details stay in MySQL. Creating a different app or
connecting an empty database creates a new installation. For future releases,
update the existing app and retain its database and persistent assets.

## Email and backups

Enquiries save to MySQL even if email is not configured. The original SMTP
integration is retained for compatible hosts, but GoDaddy managed Node.js
documents that outbound SMTP is unavailable. Do not assume Gmail/Office 365
SMTP credentials work there. A GoDaddy-compatible email integration is still
required for notifications; it has not been configured in this package.

Use **Download content backup** for text/links/settings. Back up MySQL separately
for enquiries/accounts and `public/assets/uploads` for media. Do not delete
them during deployment. Do not change the public HTML structure without a
content-field migration: the original editor uses positional field IDs.

## Local development and validation

Use Node.js 22.13 or newer. Copy `.env.example` to `.env`, retain
`NODE_ENV=development` and `STORAGE_DRIVER=sqlite`, then run `npm install`,
`npm run setup-admin` and `npm start`.

`npm run build` checks syntax. `npm test` checks authentication, content saves,
conflicts, uploads, enquiries, local SMTP, restart persistence and account
setup. The optional MySQL integration test needs `LULU_TEST_MYSQL=1` and real
`DB_*` credentials for an EMPTY DISPOSABLE database; it changes test records.
Never run it against your live database.

Local checks passed. MySQL integration was not run because no MySQL server was
available. GoDaddy connection, media persistence and email delivery require
the account-level checks above.

## Official references

- https://www.godaddy.com/en-ca/hosting/nodejs
- https://developer.godaddy.com/en/docs/api-users/hosting/app-requirements
- https://www.godaddy.com/en-uk/help/deploy-my-cursor-or-claude-app-with-godaddy-nodejs-hosting-42908
- https://github.com/godaddy/nodejs-hosting-agent-skill/blob/main/skills/godaddy-nodejs-hosting/SKILL.md
