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

1. Create a Supabase project (a paid plan, so the project never pauses). In **SQL Editor**, run `supabase/schema.sql` once.
2. **Authentication > URL Configuration:** Site URL `https://getruralamericadone.com`; add `https://getruralamericadone.com/account` and your preview domain's `/account` to Redirect URLs.
3. **Authentication > Emails > SMTP Settings:** turn on custom SMTP with your Resend credentials, sender `fieldguide@getruralamericadone.com`. In Resend, verify the domain (SPF, DKIM, DMARC records in DNS).
4. **Authentication > Email Templates > Magic Link:** subject "Your Grid & Grain sign-in link"; keep the `{{ .ConfirmationURL }}` link.
5. Copy **Project Settings > API** URL and anon key into `assets/js/config.js`. The anon key is meant to be public; row-level security protects the data.
6. Monthly note list: in the SQL editor, `select * from monthly_note_list;` and export as CSV to a Resend audience.

### Adding a module

Write `field-guide/NN-slug.html` and its `check.html` (copy Module 1's), set `KEY` and `MODULE` in the check page, then add the number to `PUBLISHED` in `config.js`.

## Local preview

```
npx serve .
```

## Deploy

Every push to `main` deploys to production on Vercel; every other branch gets a preview URL.
