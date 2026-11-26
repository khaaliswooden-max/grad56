# Get Rural America Done — website

Static site for **Get Rural America Done** (@GetRural56Done): rural health and Critical Access Hospital modernization across all 56 U.S. states and territories.

- No build step. Plain HTML, CSS, and JS; deploys on Vercel as a static site.
- `index.html` — home page. `brand.html` — logo downloads, palette, type (served at `/brand`).
- `assets/brand/` — the Furrow & Star mark and wordmark lockups (outlined SVG, no font dependency) plus social avatar PNGs.
- `assets/fonts/` — self-hosted Newsreader and Geist (SIL Open Font License).

## Field Guide and member accounts

- `field-guide.html` (`/field-guide`) lists the twelve modules; each module is `field-guide/NN-slug.html` with its self-check at `field-guide/NN-slug/check.html`.
- Reading is open to everyone. A free account (email sign-in link, no password) saves self-check scores and issues the Field Certificate at `/certificate/<id>`.
- `sign-in.html`, `account.html`, `certificate.html`, `privacy.html` are the member pages; `assets/js/members.js` talks to Supabase; `assets/js/config.js` holds the keys and the module calendar.
- With the keys in `config.js` left empty, accounts are off: modules and self-checks work, scores aren't saved, and sign-up falls back to Substack.

### Turning accounts on

1. **Supabase project** on the Pro plan (paid projects never pause for inactivity). Region: US East or US Central. In **SQL Editor > New query**, paste `supabase/schema.sql` and run it. It is safe to run again after a change.
2. **Authentication > URL Configuration:** Site URL `https://getruralamericadone.com`. Redirect URLs (sign-in links carry `?next=`, so use wildcards):
   - `https://getruralamericadone.com/account**`
   - `https://grad56-*-khaaliswooden-maxs-projects.vercel.app/account**` (Vercel previews)
3. **Resend:** add the domain `getruralamericadone.com` and put its SPF, DKIM, and MX records at the DNS host; add a DMARC record (`_dmarc`, start with `v=DMARC1; p=none; rua=mailto:<your inbox>`). Wait for **Verified**. Create an API key with **Sending access** for that domain only.
4. **Authentication > Emails > SMTP Settings:** enable custom SMTP. Host `smtp.resend.com`, port `465`, username `resend`, password = the Resend API key (typed in the dashboard, never committed). Sender email `fieldguide@getruralamericadone.com`, sender name `Grid & Grain`. Then raise **Authentication > Rate Limits > emails sent per hour** to suit (30 is the starting value).
5. **Authentication > Emails > Templates:** paste `supabase/templates/sign-in-link.html` into both **Magic link** and **Confirm signup** (a first sign-in sends "Confirm signup"). Subject for both: `Your Grid & Grain sign-in link`. The template links to `/account?token_hash=…`, which finishes sign-in on a button press on any device; `/account` also still accepts the older `?code=` links.
6. **Project Settings > API Keys:** copy the Project URL and the anon (public) key into `assets/js/config.js`. Never commit the service-role or secret key. The anon key is meant to be public; row-level security protects the data.
7. Test on the Vercel preview: sign up, land on `/account`, check the `members` row, take a self-check, delete the account, confirm the rows are gone.
8. Monthly note list: in the SQL editor, `select * from monthly_note_list;` (confirmed addresses only) and export as CSV to a Resend audience.

### Adding a module

Write `field-guide/NN-slug.html` and its `check.html` (copy Module 1's), set `KEY` and `MODULE` in the check page, then add the number to `PUBLISHED` in `config.js`.

## Local preview

```
npx serve .
```

## Deploy

Every push to `main` deploys to production on Vercel; every other branch gets a preview URL.
