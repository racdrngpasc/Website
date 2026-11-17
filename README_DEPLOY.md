# Deployment checklist

## 0. Rotate leaked keys FIRST
The old `config.js` shipped the Supabase **service-role key**, an **OpenRouter key** and the **EmailJS private key**
to every visitor. Treat all three as compromised:
- Supabase → Settings → API → regenerate the service-role (JWT secret roll)
- OpenRouter → delete the old key, create a new one
- EmailJS → regenerate the private key

## 1. Supabase
```
supabase db query < sql/001_security_and_mail.sql        # or paste in SQL editor
supabase functions deploy generate-document
supabase functions deploy send-mail-attachments
supabase functions deploy ai-chat
supabase secrets set OPENROUTER_API_KEY=... GAS_WEBAPP_URL=... GAS_SHARED_SECRET=...
```
The old `generate-*` functions can stay as fallbacks or be deleted.

## 2. Google Apps Script
Follow the header comment in `google-apps-script/Code.gs`.

## 3. Front end
Upload the JS/HTML/CSS files as before (no new front-end files).

## What changed in this round
- **Run `sql/001_security_and_mail.sql` again** (it is safe to re-run): adds the four guest-count columns on `event_reports`,
  `newsletters.cover_image_url`, a unique key on `club_settings`, and the new mail/recipient settings.
- Redeploy `generate-document` (signatures + guest counts) and `send-mail-attachments` (recipient lists), and
  re-deploy the Apps Script (Deploy → Manage deployments → Edit → New version).
- **Signatures:** meeting documents → President + Secretaries; event/avenue/DPP reports → the avenue director
  (DPP chair for DPP) + President + Secretaries; treasury → Treasurer + President + Secretaries. A vacant role
  prints a blank signature line. The director's role must be set on the member (e.g. `avenue_director_club_service`).
- **Settings → Mail & recipients:** members group, board group, custom list, CC list, a recipient list for each kind of mail,
  attachment switches, subject prefix, signature line, and a "send test to me" button.

## Multi-role update (run in this order)
1. `sql/002_admin_portfolios.sql` (if not already run) then `sql/003_multi_roles.sql`.
2. Redeploy `generate-document`; upload `config.js, auth.js, admin.js, members-admin.js, app.js, email-service.js, styles.css`.
3. Admin Users → ✏ Edit: choose a main role, tick *Additional roles* and every *Portfolio*.
   Members → edit: *Additional roles* and *Additional portfolios / designations*.
4. A person with two posts (e.g. Treasurer + DPP Chair) signs each document with the title that belongs to it.

## Mail attachments (what each mail carries)
- Event approved → every poster of the event (from event_photos / poster_url).
- Meeting invitation → meeting poster + agenda.
- Meeting minutes → combined record (agenda + attendance + minutes + photos) + attendance Excel.
- Event report published → event report (with photos) + posters.
- Monthly treasury → treasury statement (PDF + Excel) + one file with the report of every project of that month.
If the attachment mailer is not working the admin now sees a warning toast instead of a silent plain mail.

## SQL order (important)
Run in this order, each once: `001_security_and_mail.sql` → `002_admin_portfolios.sql` → `003_multi_roles.sql`.
All three were tested on a real PostgreSQL database that uses an enum column for `role`; each can be re-run safely.
If 003 prints "run 002 first", run 002, then run 003 again.

## Connecting the attachment mailer (needed for posters, reports, minutes and Excel in mails)
Until this is done every mail goes out without files and the admin sees "Sent WITHOUT attachments".
1. Apps Script project → Project Settings → Script properties → add `SHARED_SECRET` = a long random text (no spaces).
2. Apps Script → Deploy → New deployment → Web app → Execute as **Me**, Who has access **Anyone** → copy the `/exec` link.
   Opening that link in a browser must show `{"ok":true,"service":"Rotaract mailer", ...}`.
3. Supabase → Project Settings → Edge Functions → **Secrets** → add
   `GAS_WEBAPP_URL` = the /exec link, and `GAS_SHARED_SECRET` = the same text as SHARED_SECRET.
   (CLI alternative: `supabase secrets set GAS_WEBAPP_URL="..." GAS_SHARED_SECRET="..."`.)
4. Deploy the function once: `supabase functions deploy send-mail-attachments` (and `generate-document`).
5. In the admin panel: Site Settings → Mail & recipients → **Test with attachments**. It mails only you and tells you what to fix.

## If mails still arrive without files — the three usual causes (in order)
1. **Apps Script permissions.** The mailer now uses `MailApp` (needs only the `script.send_mail` permission).
   Paste the manifest from the bottom of `Code.gs` (Project Settings → Show "appsscript.json"), run `authorizeOnce()`
   from the editor and accept, then **Deploy → Manage deployments → Edit → New version**. An old deployment keeps
   the old permissions.
2. **Secrets.** Supabase → Edge Functions → Secrets must hold `GAS_WEBAPP_URL` and `GAS_SHARED_SECRET`
   (same text as `SHARED_SECRET` in Apps Script). Then deploy `send-mail-attachments` and `generate-document`.
3. **Heavy PDFs.** If a PDF is too big for the server (HTTP 546) the **Word version of the same document** is attached and
   the admin sees a notice, so a mail never goes out without its document. Templates are unchanged.
Use Site Settings → Mail & recipients → **Test with attachments** (sends a PDF + Excel to yourself) to see which step fails.

## Mail end signature = the person who pressed Send
Every club mail ends with the signed-in person's details (the documents keep their own signature blocks):
name · portfolio(s) · RI ID · club name · group number · RI district.
- Portfolios come from Admin Users (Site Settings → Portfolios); if none, from the member's titles; else the role names.
  A person with two posts shows both (e.g. "Treasurer & DPP Chair").
- The RI ID comes from the person's Members record (linked by member, then by e-mail, then by name).
- Switch it off or set a fallback line for automatic mails in Site Settings → Mail & recipients → Message style.

## Site Settings not saving? Run `sql/004_fix_settings_access.sql`
An earlier `001` made `club_settings` read-only (and `email_logs` private) with row-level security. The admin panel saves with the
public key, so Supabase refused (or silently ignored) every change. `004` repairs that database, and the corrected `001`/`002`
no longer do it. Run `004` once in the Supabase SQL editor (safe to re-run). The panel now also says *why* a save failed
instead of showing "Saved".

SQL order for a new database: 001 → 002 → 003 (004 is only needed on a database that already ran the old 001).
All four files were tested twice each on a real PostgreSQL database (enum role column, browser-style "anon" access, strict error checking).

## Supabase Data API change — 30 October 2026
From 30 Oct 2026 Supabase no longer auto-grants API access to NEW tables in `public` (existing tables are untouched).
- Every table created by `sql/001`–`003` now carries explicit `GRANT` lines (anon / authenticated / service_role).
- `sql/004` section 5 re-applies those grants (run it once, safe to re-run) and holds the template to paste into any
  future migration: `grant select on public.your_table to anon;` etc.
- Multiplayer game rooms use **Supabase Realtime Broadcast + Presence only** — they create no tables, so they need no grants.
  (Realtime must be enabled for the project; it is on by default.)

## Birthday e-mail
`email-service.js` → `sendBirthdayWish` has a new layout: club logo, a built-in cake graphic and star/diamond badges drawn
with plain HTML/CSS (no emoji, no remote images), so it renders the same in Gmail, Outlook and phone apps. The old template
printed a broken character code (`&#B30F57;`); that is fixed.

## Erase all data (super admin only)
Site Settings → **Advanced** → **Danger zone** → *Erase all data*. Pick what to erase (events, meetings, treasury, added admin
accounts, members, bulletins/applications/blood requests, logs/scores), type `ERASE ALL DATA`, confirm. Always kept: Site Settings,
portfolios, every super-admin account, and image files on Cloudinary. If a table cannot be cleared the dialog names it and why.

## Games — multiplayer rooms
`games.js` now has a room system: **Create room** (4-letter code, you are the host) or **Join with code**. The host picks the
game, everyone sees the live lobby, the host starts. A room closes when the host presses *Close room*, when the host leaves or
disconnects, after 3 minutes on the results screen with no action, or after 10 idle minutes. Ten multiplayer games were
added (category *Multiplayer*): Connect Four, Rock Paper Scissors Arena, Quick Draw, Trivia Showdown, Hangman Duel, Word Scramble Race,
Memory Clash, Pig Dice Race, Tap Rush, Draw & Guess. All earlier single-player games are unchanged.
If a room cannot be created ("Could not reach the multiplayer server"), open Supabase → Realtime → Settings and make sure
public (anon) channels are allowed — rooms use ordinary public Broadcast/Presence channels named `rac-games-<CODE>`.

---
## Update 2 — what was added

**Run / deploy these after copying the files**
1. `sql/004_fix_settings_access.sql` in the Supabase SQL editor (sections 5–7: grants, erase-data notes, **Team Chat tables + `chat-files` storage bucket**). Safe to re-run.
2. `supabase functions deploy generate-document` (multi-language PDFs + opening balance in statements).
3. Re-deploy your Google Apps Script mailer only if you changed it — mail HTML is built in `email-service.js`.

**1. Images ≤ 150 KB, everywhere** — `ImageUtils.compress` (config.js) now lowers quality and then size until the result is 150 KB or less, and the
Supabase client also compresses *any* image sent to Storage (even from screens that forgot to). Admins see "Image optimised: 4.2 MB → 138 KB".
PDFs and other files are never changed.

**2. Treasury**
- *Opening balance*: Treasury → Overview → **Set opening balance** (amount, as-of date, note). Stored in Site Settings (`treasury_opening_*`).
  All running balances, statements (PDF/Word/Excel) and the monthly mail start from it.
- *Languages*: Word and Excel files and all mails handle every language. PDFs embed a matching **Noto Sans** font on demand for Tamil, Hindi, Telugu, Kannada,
  Malayalam, Bengali, Gujarati, Punjabi, Arabic, Hebrew, Thai, Cyrillic and Greek (English and local text can share a line). The fonts are downloaded by the edge
  function from the jsDelivr CDN the first time they are needed. Chinese / Japanese / Korean are not embedded in PDFs (the files are too large) — they still work in Word, Excel and mail.
- *Advanced treasury mail*: opening / closing balance, income, expenses, net change, category bars, transaction table (phone friendly).

**3. Team Chat** (admin sidebar → *Team Chat*) — direct chats, groups, announcement-only groups, a built-in *All Admins* room, replies, forwards, edit, delete for me / everyone,
reactions, star, pin, @mentions, polls, tasks, event cards, photos (auto-compressed), files (10 MB), voice notes, emoji, typing, online status, read receipts ("seen by"),
disappearing messages, search, unread badges, sound and desktop notifications, export chat. **Super Admin** gets a *Monitor* tab: every chat (including deleted and edited text),
a dashboard with statistics, reported messages, per-admin activity, mute / block, moderation delete, archive, search across all chats and transcript export. Members are told
that chats are monitored. Note: like the rest of the portal, chat rows use the public key with open row-level-security policies; the Super Admin tools are enforced by the portal screens.

**4. All devices** — layouts checked at 320 / 375 / 768 / 1024 / 1440 px (no sideways scrolling), 16 px inputs on phones (no iOS zoom), 44 px touch targets, safe-area insets,
reduced-motion support, one-pane chat on phones.

**5. Mails** — one shared responsive wrapper (club header, ribbon, footer), phone-friendly rows/buttons/tables, no emoji, font stack that shows local-language text.

**6. Extra advancements** — *Download full backup* (Site Settings → Advanced → Danger zone; also offered automatically before *Erase all data*; passwords are never included),
**Ctrl / ⌘ + K** quick search (screens, members, events), and an offline banner.

---
## Update 3 — Automatic geo-tagging of report photos (all avenues)

Where: **Events → Submit / Edit Report → Action Photographs → “Geo-tag action photos”** (the same report form is used by every avenue).

1. Paste the Google Maps link (for example `https://maps.app.goo.gl/uL3Cb1Q4o6qNUUHc9`, a full `google.com/maps/...` link, or just `11.0168, 76.9558`) and press **Detect** (pasting also detects automatically).
   A step-by-step **link diagnosis** shows what was understood: link type, redirect followed, coordinates, location check and place name. Latitude, longitude and the
   location name are filled in and can be edited. Short links are opened by the server (browsers cannot follow Google redirects), so the
   `generate-document` function must be deployed: `supabase functions deploy generate-document`. It only ever contacts Google hosts.
2. Choose the photos. Each one gets an overlay with: **event name, location name, latitude, longitude, event date, a random time inside the event hours (increasing from photo to photo)
   and a small street map with a pin**, with the club name on top and viewfinder corners. A live preview shows exactly how it will look; **New random times** re-rolls the times.
3. **Skip geo-tagging** (top right of the panel) leaves *all* photos untouched — use it when photos were already geo-tagged by another app. Each thumbnail also has its own
   pin button to switch geo-tagging off for just that photo.
4. Stamped photos are saved at **150 KB or less** and the position and date are also written into the JPEG’s GPS/EXIF data, so phones and Google Photos show the location too.
5. The link and position are remembered on the event (`sql/004` section 8 adds `geo_link / geo_lat / geo_lng / geo_place`; run it once) so the next batch is pre-filled.

Notes: the mini map uses only providers that need no key, tried in this order: **OpenStreetMap, then OpenStreetMap France, then Esri** (each map is drawn from a single provider, and its credit is printed on the map); Google’s own map tiles cannot be drawn into photos without a paid
Static Maps key. If the tiles cannot be reached the card shows a neutral map placeholder. Photos uploaded earlier are not re-stamped; upload them again to geo-tag them.

---
## Update 4 — geo-tag link fixes, meeting rules, opening balance in documents, guest names

**Run / deploy**
1. `sql/004_fix_settings_access.sql` again (new sections 9 and 10: meeting rules + emergency-meeting invitees, guest-name columns).
2. `supabase functions deploy generate-document` (statements from the opening balance, guest names in reports, map links).
3. `supabase functions deploy resolve-map-link --no-verify-jwt` (**new**, small function that opens `maps.app.goo.gl` / `share.google` links).

**Geo-tag links** — now understands Google *search* links (`google.com/search?q=R.S.+Puram,+Coimbatore…`) and `/maps/place/…` links without a pin by looking the place up by name,
and tries `resolve-map-link`, then `generate-document`, then a public relay for short links; if everything fails the diagnosis says exactly why and you can type latitude / longitude.

**Meetings**
- Only the **Super Admin, President, IPP, Vice President, Secretaries and Club Advisor** can schedule Board, General Body and Special meetings. Every other admin sees only *Schedule Emergency Meeting*.
  Enforced in the form, in the save code and by a database trigger.
- **Emergency meetings** are for *selected members*: pick them in the form. The invitation, attendance form and minutes go **only** to them; only the creator, the invited admins and the Super Admin can open the meeting
  in the portal; the attendance page accepts only the invited e-mail addresses (checked against SHA-256 hashes, also by a database trigger).
- **Board meeting** mails (invitation, attendance form, minutes) go **only** to the Board Google Group, **General Body** mails **only** to the Members Google Group (Site Settings → Mail & recipients).
  If the board group is empty nothing is sent for a board meeting — it never falls back to all members. Extra CC addresses are not added to these meeting mails.

**Opening balance in documents** — PDF, Word, Excel, CSV and the monthly mail now start from *opening balance + every earlier transaction*, show an “Opening Balance b/f” line and a closing balance,
and work out running balances themselves (stored balances can no longer make a document wrong).

**Guest names** — the report form collects the *names* (one per line) of Council Members, District Trainers, Interactors and Rotarians; the counts follow the names. A “Guests & Dignitaries Present” table appears in the
event report and in the monthly / avenue / DPP reports (PDF and Word), with a per-event overview in the period reports.

---
## Update 5 — meeting-save error, treasury PDF/Word, mail redesign, document languages

- **Meeting save error** (`invalid input value for enum meeting_type: ""`): caused by the database rule from Update 4 comparing the enum column with an empty string. `sql/004` section 9 is fixed
  (everything compared as text, and a rule that cannot be evaluated never blocks a save). **Re-run `sql/004_fix_settings_access.sql` once.**
- **Treasury PDF / Word**: the portal now checks the version of the `generate-document` function. If it is outdated (as in the file you sent) the statement is built in the portal itself — a real `.docx` and `.pdf`
  starting from the opening balance, income and expense listed separately, every language shown correctly. The warning “possible double counting” appears in *Set opening balance* if an old “Opening Balance” income entry exists.
  Deploy the new function (`supabase functions deploy generate-document`) to get the server-built layout and PDF text (not images) for all other reports.
- **Mails**: one clean layout for every mail — full width on phones (no frame or coloured margin), soft grey page with a centred card on larger screens. The birthday mail uses the member’s full name (“Dear Rtr. Kavin,”).
- **Languages in documents**: Word/Excel/CSV/mail show every language; server PDFs embed Noto fonts (Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali, Gujarati, Punjabi, Arabic, Hebrew, Thai, Cyrillic, Greek);
  treasury PDF/Word built in the portal support every script the device can draw. Chinese/Japanese/Korean are not embedded in server PDFs.

## SEO setup (do once after the site is live)
1. The sitemap, robots and llms files already use `https://www.rotaractdrngpasc.in`. If the main address ever changes, update it in `sitemap.xml`, `robots.txt`, `llms.txt`, the canonical / `og:url` tags and the structured data in `index.html`.
2. Add the site in Google Search Console and Bing Webmaster Tools, then submit `https://your-domain/sitemap.xml`.
3. Canonical links and `og:url` point to `https://www.rotaractdrngpasc.in` (the address without `www` redirects to it).
4. `admin.html` and `attendance.html` carry a `noindex` tag, so keep them crawlable (do not Disallow them in robots.txt).
5. For better link previews, upload a 1200x630 banner image and point `og:image` / `twitter:image` (and `twitter:card` = `summary_large_image`) at it.

## CSS unit rules (keep new CSS consistent)
- **Font sizes:** `rem`. The root size is set in `%`, so it follows the visitor's browser text-size setting. Form inputs use `max(1rem, 16px)` on phones so iOS does not zoom when they are tapped. HTML emails (`email-service.js`) and generated documents keep `px`, because many email apps ignore `rem`.
- **Layout widths:** `%` (for example `width: 100%`), with a `max-width` cap in `px` so text does not stretch too wide. Icons, avatars and other fixed-size parts stay in `px`.
- **Borders and shadows:** `px`.
- **Full-screen sections:** viewport units (`100vh` / `100svh` for height, `inset: 0` for overlays). Avoid `width: 100vw` on normal sections, because it includes the scrollbar and causes sideways scrolling.
- **Button padding:** `em`, so padding scales with the button's text size.

## 3D hero (optional)
`js/hero3d.js` adds a Three.js scene behind the hero text (two turning gears, floating shapes, particles) that reacts to the mouse and to scrolling through GSAP ScrollTrigger.
- It loads Three.js and GSAP from jsDelivr after the page has finished loading, so it does not slow the first view or the SEO score.
- It only runs on landscape tablet and desktop windows (768px and wider) with WebGL, enough memory and a normal connection. It is skipped for reduced-motion, Save-Data and slow-network visitors, and phones keep the light CSS hero.
- It draws only while the hero is on screen, and it frees all its GPU memory when it stops.
- Turn it off for everyone: set `enabled: false` at the top of `js/hero3d.js`. Turn it off for one visit: add `?3d=off` to the address. Force it on for testing: `?3d=on`.

## Script order (keep it)
The scripts in `index.html` load with `defer`, which keeps the page from waiting on them. They run in the order listed: the CDN libraries (Lucide, Supabase, AOS, Swiper and others), then `js/config.js` through `js/app.js`, then `js/page-init.js`, then `js/hero3d.js`. `js/page-init.js` holds the setup code that used to be inline (AOS, icons, theme, loader), so it must stay after the libraries and `app.js`.

