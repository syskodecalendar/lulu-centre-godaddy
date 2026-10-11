# Lulu Centre — persistent admin storage

Start with **GODADDY-SETUP.md** for GoDaddy Deluxe Node.js hosting.

Production content, settings, enquiries and the admin account use MySQL.
Uploads use `public/assets/uploads`, GoDaddy's documented persistent assets
folder. The original public design, animations and bundled assets are retained.

Use Node.js 22.13 or newer. The ZIP has build/start scripts and a lockfile.
Never include real credentials or node_modules when uploading.

For local development, run npm install, copy .env.example to .env, run
npm run setup-admin and then npm start. The example uses development SQLite;
configure MySQL and production settings before publishing on GoDaddy.

Content backup/restore buttons are in Logo & email settings. Back up MySQL and
uploaded media separately. Layout changes and new pages require development.

The original SMTP implementation is retained for compatible hosts. GoDaddy
managed Node.js requires a separate email integration; enquiries remain in the
persistent admin inbox without email delivery.

Run npm run build and npm test for local checks. The optional MySQL test needs
an empty disposable database; see GODADDY-SETUP.md. Live GoDaddy connection
and persistence must be checked after account configuration.

The walkthrough video uses the provided Render-hosted URL; no MP4 is bundled.
Keep the source Render service online. If an existing admin setting overrides
the video source or its download link, set both fields to the new URL.
