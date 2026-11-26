# Member email

Sources for the Grid & Grain monthly member note. One note a month, sent as a Resend Broadcast on
the day a module opens (first Tuesday), then mirrored to Substack.

| File | What it is |
| --- | --- |
| `YYYY-MM.html` | The note as an HTML email. Paste into the Resend Broadcast. |
| `YYYY-MM.txt` | The same note as plain text. Paste into the Broadcast's plain-text version. |
| `YYYY-MM-substack.md` | The same note as a Substack post. |

The sign-in email is not here: it lives in `supabase/templates/sign-in-link.html`.

## Rules for every note

- Under 150 words, not counting the footer. Brand voice. Every item is a link to the site.
- Sender: `Grid & Grain <fieldguide@getruralamericadone.com>`. Replies forward to the Gmail inbox.
- `{{{RESEND_UNSUBSCRIBE_URL}}}` stays exactly as written, in both files. Resend swaps in each
  reader's own link. A note with no unsubscribe link must not be sent.
- Replace `POSTAL ADDRESS GOES HERE` with the mailing address before the first send, in both files.
- No images, web fonts, or tracking pixels. Tables and inline styles only, 600px wide, so it holds
  up in Gmail, Outlook, and Apple Mail and reads the same with images blocked.
- Colors: ink `#0E1A2B`, paper `#F6F4EF`, paper-2 `#EDEAE2`, field blue `#2B4C7E` (links and labels),
  flag red `#B23A3A` (one 3px rule only), footer gray `#4A5566`. All text passes 4.5:1.
- Link tags: `?utm_source=member-note&utm_medium=email&utm_campaign=YYYY-MM` on email links,
  `utm_source=substack&utm_medium=post` on Substack links.
- Numbers follow the fact-check rule: only figures from the module or the Straight Talk library,
  with the grade.

## Making next month's note

Copy last month's three files to the new month. Change: the title, subject, and preview text (the
hidden line at the top of `<body>` and the comment in `<head>`), the module paragraph and button
link, the Carry This line (copy it from the module page), the County Kit line and link, the
self-check link, the corrections paragraph (new entries since the last note, or "None this month"),
and `utm_campaign`. Drop the "Starting today" sentence after January. The monthly checklist is in
the project doc `grid-and-grain/build/status-ws6.md`.
