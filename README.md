# SolarWave Tech Enterprises – Facebook Ads Landing Page

A single-file landing page that qualifies Facebook ad traffic through a 7-question
quiz, scores each lead, and posts it to any endpoint you choose.

```
index.html      the whole page (HTML + CSS + JS, no build step)
images/         web-optimized photos and the cut-out logo
assets/         your original photos (not used by the page, keep as source)
```

## 1. Before you go live: edit the settings block

Open `index.html` and edit the block near the top:

| Setting | What it does |
|---|---|
| `endpoint` | URL that receives each lead as a POST. Leave empty while testing: the lead prints to the browser console (F12) instead. |
| `endpointFormat` | `json` (default), `form` (URL-encoded), or `text` (JSON sent as text/plain, which Google Apps Script needs to avoid CORS errors). |
| `fbPixelId` | Your Meta Pixel ID. When set, the page fires `PageView` on load, a custom `QualifierStart` on the first answer, and `Lead` on a successful submit. |
| `phone` / `phoneDisplay` | Tap-to-call number and how it is shown. |
| `messenger` | Your page's m.me link, e.g. `https://m.me/solarwavetech`. |
| `email`, `address` | Optional. Shown in the footer only when filled in. |
| `thankYouRedirect` | Optional. Full URL of a separate thank-you page if you prefer URL-based conversion tracking. |

Also replace the `og:image` meta tag with the full public URL of `images/hero-roof.jpg`
once the site is hosted, so link previews on Facebook show the photo.

## 2. Where leads go

Each submission is a flat object with these fields:

- Contact: `full_name`, `phone` (normalized to +63 format), `phone_entered`, `email`, `contact_method`
- Answers: `bill`, `ownership`, `property_type`, `priority`, `roof`, `city`, `province`, `timeline` (each with a matching `_label` field in plain English)
- Scoring: `score` (0–8), `lead_temperature` (`hot` / `warm` / `cold`), `qualified` (true/false), `flags` (`needs_owner_approval`, `low_bill`, `long_timeline`), `recommended_system`, `typical_system_size`
- Attribution: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid`, `page_url`, `referrer`, `user_agent`, `submitted_at`

Scoring rules (edit `scoreLead` in the script if you want different weights):

| Answer | Points |
|---|---|
| Bill under ₱3k / 3–6k / 6–10k / 10k+ | 0 / 1 / 2 / 3 |
| Owner, family-owned, or business / renting | 2 / 0 |
| ASAP / 1–3 months / 3–6 months / researching | 3 / 2 / 1 / 0 |

`hot` = 6 or more, `warm` = 3–5, `cold` = under 3. Renters and sub-₱3k bills are
still captured but marked `qualified: false` so your team can prioritize.

### Google Sheet receiver (current setup)

The page posts to a Google Apps Script web app bound to your leads spreadsheet.
The script source is in `google-apps-script/Code.gs`. It writes one row per lead to the
"Leads" tab and emails an alert to the address set in `NOTIFY_EMAIL`.

To change the script: paste the new code into Extensions > Apps Script, save, then
Deploy > Manage deployments > pencil icon > Version "New version" > Deploy. Saving alone
does not update the live URL. The URL stays the same, so the page needs no change.

### Bill photo upload

After a lead submits, the thank-you screen offers an optional "add a photo of your bill"
button. Photos are shrunk in the browser to about 1600px (roughly 300 KB), PDFs are sent
as-is, and files over 6 MB are refused with a message. The script saves the file to a Drive
folder called "SolarWave Bill Photos" and writes its link into the lead's row in the
`bill_photo` column. Keep that folder restricted to your team: bills carry names,
addresses and account numbers.

Each lead also carries a `lead_id` (for example `SW-M1ABCD-X7Q2`) so the photo can be
matched to the right row even if two people share a name.

### Other ways to receive leads

- **Zapier / Make webhook** – paste the webhook URL as `endpoint`, use `json`. Route to Sheets, CRM, Messenger, SMS, etc.
- **Formspree / Basin / similar** – paste the form URL, use `json` or `form` depending on the service.

These do not handle the bill photo upload unless the receiving service accepts a base64 `data` field.

## 3. Hosting

Upload `index.html` and the `images/` folder to any static host (Netlify, Vercel,
Cloudflare Pages, GitHub Pages, or your existing web host). No server code is needed.

Put your Facebook ad's destination URL with UTM tags, for example:
`https://yourdomain.com/?utm_source=facebook&utm_medium=paid&utm_campaign=solar-sept`

## 4. Copy that makes a promise (review these)

The page states things a customer will hold you to. Change the wording if any of
these do not match how you operate:

- "A SolarWave specialist will reach out within 1 business day" (contact step and thank-you)
- "Free site assessment and written proposal" and the FAQ answer "Is the assessment really free?"
- "Most residential installs take one to three days" (FAQ)
- "We'll walk you through the application with your utility" (net metering FAQ)
- Typical system size ranges shown on the thank-you screen (`TYPICAL_SIZE` in the script)

## 5. Suggested additions once you have them

- Two or three real customer testimonials with first name and city
- Number of completed installs, years in business, warranty terms
- A short install video in place of the "How it works" photo
