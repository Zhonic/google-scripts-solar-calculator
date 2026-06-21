# Solar Pricing Calculator (Google Apps Script)

A self-hosted internal sales calculator for solar + battery quotes, built on **Google Apps Script**. A sales rep fills in a short form (system size, inverter, battery, roof/house details, rebate eligibility) and gets an instant, GST-correct out-of-pocket price they can copy straight into a quoting system. Pricing lives in **one shared Google Sheet**, so the whole team always quotes off the same numbers — but only named admins can change them.

> The dollar figures and rebate settings shipped here are **illustrative example values**, not live pricing or current legislation. They exist so the tool is usable the moment you open it. Replace them with your own, and verify all rebate figures against the Clean Energy Regulator and your state scheme before quoting a real customer.

---

## Why it's built this way

The interesting constraint is **shared pricing with restricted editing, on infrastructure a small business already owns.** No server, no database, no hosting bill — just a Google account.

- **One source of truth.** Pricing is stored as JSON in cell `A1` of a `Config` tab in a Google Sheet. Every rep's calculator reads from it, so nobody is quoting off a stale local copy.
- **Server-enforced admin gate.** Anyone with the web app URL can *use* the calculator and *read* pricing. Only the Google accounts listed in `ADMIN_EMAILS` (in `solar-calculator-template.gs`) can *save* changes. The check runs server-side in `saveConfig()`, so it can't be bypassed by editing the page in the browser.
- **Runs as the owner.** The web app executes as the deploying account, so reps never need any access to the Sheet itself — only the URL.

---

## Architecture

```
┌─────────────────────┐         ┌──────────────────────────┐
│  Sales rep / admin  │  HTTPS  │  Apps Script web app      │
│  (browser)          │ ──────▶ │  doGet() serves Index.html│
└─────────────────────┘         └────────────┬─────────────┘
        ▲                                     │
        │ google.script.run                   │ getConfig() / saveConfig()
        │ (async calls)                       ▼
        │                        ┌──────────────────────────┐
        │                        │  Google Sheet "Config"    │
        └──────── pricing ───────│  A1 = pricing JSON        │
                                 │  (shared, owner-held)     │
                                 └──────────────────────────┘
                                              ▲
                                              │ writes allowed ONLY if
                                              │ Session email ∈ ADMIN_EMAILS
                                              └── (enforced in solar-calculator-template.gs)
```

Two files make up the whole app:

| File | Role |
|------|------|
| `solar-calculator-template.gs` | Backend. Serves the page, reads/writes the Config sheet, enforces the admin check. |
| `Index.html` | The entire front end — form, live quote summary, and admin pricing panel — in one file. Talks to the backend via `google.script.run`. |

---

## How the price is built

Every input dollar value is entered **ex GST**; the calculator applies `× 1.1` automatically. The total is assembled from:

1. **Panel cost** — `panels × watts × $/watt × 1.1`
2. **Labour** — `labourFactor × total watts × 1.1` (a per-watt rate)
3. **Battery package** — `(product + labour) × 1.1`, filtered to the chosen inverter brand
4. **Adders** — roof (a per-panel rate), house type, sub-board, phase, backup
5. **Extra cost** — a free-text field for the rep, ex GST
6. **Hidden margin** — a per-battery `profit` value added silently to the total (not shown to sales in the UI)

Then deductions are applied to reach the customer's out-of-pocket price:

- **Federal panel STCs** — `floor(kW × zoneRating × deemingYears) × STC price`
- **Federal battery STCs** — a tiered factor calculation (`batteryStcCount`)
- **State rebate + interest-free loan** — applied only when eligible (the example uses Victoria)

When a state rebate/loan applies, the summary shows **two** out-of-pocket figures: with the interest-free loan, and with the loan paid upfront.

---

## Configuration reference (`solar-calculator-template.gs`)

| Setting | What it does |
|---------|--------------|
| `ADMIN_EMAILS` | Array of Google login emails allowed to save pricing. **Edit this first.** |
| `APP_TITLE` | Browser tab / page title. |
| `SPREADSHEET_ID` | Leave blank when the script is **bound** to the Sheet. Set it only for a standalone script. |
| `CONFIG_SHEET` / `CONFIG_CELL` | Where the pricing JSON is stored (`Config` tab, cell `A1`). Auto-created on first run. |

In `Index.html`, two constants near the top of the `<script>` block re-label the UI:

| Constant | What it does |
|----------|--------------|
| `BRAND_NAME` | Masthead heading, page title, and the header line on copied quotes. |
| `QUOTING_SYSTEM` | Name of wherever reps paste figures (your CRM/proposal tool). |

---

## Setup

About 15 minutes, done once, signed in with the **company Google account** that should own the tool. The `Config` tab and its JSON cell are created automatically on first run — there is no spreadsheet file to import.

### 1. Create the data store (the Sheet)

1. Go to **sheets.google.com** and create a **blank spreadsheet**.
2. Name it something like **"Solar Calculator — Config"**. Leave it empty; the script adds the `Config` tab itself.

### 2. Open the bound script

3. In that spreadsheet, click **Extensions → Apps Script**. A new project opens, already linked to the Sheet.

### 3. Add the code

4. Delete the sample `myFunction` in `solar-calculator-template.gs` and **paste the full contents of `solar-calculator-template.gs`** from this repo.
5. Edit **`ADMIN_EMAILS`** with the exact Google login emails allowed to edit pricing:
   ```js
   var ADMIN_EMAILS = [
     'you@yourcompany.com.au',
     'second-admin@yourcompany.com.au'
   ];
   ```
   Leave **`SPREADSHEET_ID`** blank (the script is bound to the Sheet). Optionally set **`APP_TITLE`**.
6. Click the **+** next to "Files" → **HTML**. Name it exactly **`Index`** (capital I, no `.html`), then paste the full contents of `Index.html`.
7. Optionally, near the top of the `<script>` block in `Index.html`, set **`BRAND_NAME`** and **`QUOTING_SYSTEM`**.
8. **Save** (Ctrl/Cmd+S).

> The HTML file MUST be named `Index` — the backend serves it with `createHtmlOutputFromFile('Index')`.

### 4. Deploy as a web app

9. **Deploy → New deployment** → gear icon → **Web app**.
10. Set **Execute as: Me**, and **Who has access: Anyone within [Your Company]** (recommended if all reps have company accounts; choose "Anyone with a Google Account" if some are external).
11. **Deploy**, then authorize access. First time only: if you see a warning, **Advanced → Go to [project] (unsafe) → Allow** — normal for your own script.
12. Copy the **Web app URL**. That URL *is* the calculator — bookmark it and share it with sales.

### 5. Enter your pricing (first run)

13. Open the URL as an admin and click **Admin** (top right) — the panel opens with no password because your email is in `ADMIN_EMAILS`.
14. Either **Import JSON** the provided `sample-config.json` to start from a worked example, or fill everything in manually. Enter all dollar values **ex GST** — the tool adds the ×1.1 automatically.
15. Click **Save settings**. It writes to the shared Sheet, and every rep sees the new pricing on their next refresh.

### Updating the code later

Editing `solar-calculator-template.gs` or `Index.html` does **not** go live until you redeploy. Use **Deploy → Manage deployments → pencil (edit) → Version: New version → Deploy**. This keeps the **same URL** (creating a brand-new deployment instead gives a new URL). Adding or removing an admin is the same flow: edit `ADMIN_EMAILS`, then redeploy as a new version.

---

## Everyday use

- **Sales rep:** open the URL → fill the form → **Copy summary**. They never touch Admin (clicking it just reports they don't have access).
- **Admin:** open the URL → **Admin** → change pricing → **Save**. Changes appear for everyone on their next page refresh.

## Seeding pricing with `sample-config.json`

`sample-config.json` is a ready-made example with realistic (but invented) numbers. To load it: open the app as an admin → **Admin → Import JSON** → pick the file → it saves to the shared Sheet for everyone. Use it to see the tool working end-to-end before entering your own figures.

> `sample-config.json` is safe to keep in the repo because the numbers are fictional. If you ever **Export JSON** from a live deployment, that file (`solar-config.json`) contains your real cost and margin data — it is git-ignored on purpose. Keep it out of the repo.

---

## Known limitations & honest notes

- **Margins are not truly hidden.** Sales don't see `profit`/cost in the UI, but a technical user could read the config in the page source. For genuine hiding, move the price maths into `solar-calculator-template.gs` so the page only receives final figures. (Documented here rather than silently "fixed" because the trade-off — simplicity vs. true concealment — is a real product decision.)
- **Rebate figures are examples, not law.** STC deeming years, battery STC factor, zone ratings, and state rebate amounts change. Treat the shipped values as placeholders and confirm current figures before quoting.
- **Admins must sign in with a company-domain account.** The email check relies on `Session.getActiveUser().getEmail()`, which can return blank for personal accounts accessing from outside the domain — such a user would be treated as non-admin.
- **Last write wins.** Two admins saving in the same minute will have one overwrite the other. Fine for a small team.
- **Supplier pricing is manual.** There's no live wholesaler feed; pricing is entered by hand or bulk-loaded via Import JSON. A server-side fetch in `solar-calculator-template.gs` is the natural extension if a dealer API becomes available.

---

## License

MIT — see [LICENSE](LICENSE).
