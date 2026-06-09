# 🏠 RentalDesk Robot

**A free, open-source landlord dashboard that runs entirely in your web browser.**
Paste a tenant's message → it figures out what's broken, checks warranties, drafts a reply, tracks rent and reminders, runs property calculators, and exports everything to **real Excel files**.

No server. No account. No install. No database. Just open it and go.

> 🔗 **Live demo:** https://kyodopartners.github.io/free-tools/rentaldesk-robot/

---

## ✨ What it does

- **Reads tenant messages.** Paste an email or text and the built-in "robot" classifies it (HVAC, plumbing, appliance, electrical, roof, door/lock, pest), assigns a priority, and writes a one-paragraph summary.
- **Matches warranties.** If the property has a warranty record that fits, it tells you to call that vendor *first* — and whether the warranty looks active or expired.
- **Drafts a tenant reply** in a friendly, owner-style voice you can copy with one click.
- **Tracks rent, leases, and missing receipts** on a clean dashboard.
- **Runs 5 landlord calculators:** repair-vs-replace, vacancy cost, CapEx reserve, monthly cash flow, and warranty value.
- **Two-way Excel.** Export all your data to a multi-sheet `.xlsx` workbook, edit it in Excel/Google Sheets, and import it back.
- **Private by design.** Everything is stored locally in your own browser (`localStorage`). Nothing is uploaded anywhere.

---

## 🛠 How it's built

| Layer | Choice | Why |
|------|--------|-----|
| **UI** | Plain HTML + CSS | No build step; opens by double-clicking `index.html` |
| **Logic** | Vanilla JavaScript (no framework) | Lightweight, readable, zero dependencies to install |
| **Storage** | Browser `localStorage` | Data persists across refreshes with no server or database |
| **Excel** | [SheetJS](https://sheetjs.com) (via CDN) | Reads and writes genuine `.xlsx` files in the browser |
| **Hosting** | GitHub Pages | Free static hosting with a public live URL |

The whole app is **three files** plus docs — small enough to read end-to-end.

### How the "robot" reads a message
The classifier matches **whole words**, not letters inside words. (An early version matched substrings, so "ba**ck** door **lock**" was wrongly read as an air-conditioning emergency because "ac" lives inside "back." That class of bug is fixed here.) Each category is scored, a named appliance is weighted to win over generic plumbing words, urgent keywords ("gas smell", "sparks", "flood") bump the priority, and the result drives the warranty match and suggested reply. See `classify()` in [`app.js`](app.js).

---

## ▶️ Run it

**Locally (easiest):** download this repo and double-click `index.html`. That's it.

**Live on the web (free):** push these files to a GitHub repo and turn on **GitHub Pages** (Settings → Pages → deploy from `main` / root). GitHub gives you a public URL you can share or put on a résumé. Step-by-step instructions for non-developers are in [`GITHUB_SETUP_FOR_BEGINNERS.txt`](GITHUB_SETUP_FOR_BEGINNERS.txt).

---

## 📁 Project structure

```
rentaldesk-robot/
├── index.html     # page shell, nav, Excel toolbar, fonts, SheetJS
├── styles.css     # all styling (warm "field-notebook" theme)
├── app.js         # state, robot classifier, views, Excel import/export
├── README.md
├── LICENSE        # MIT
└── GITHUB_SETUP_FOR_BEGINNERS.txt
```

---

## 🎯 What this is — and isn't

This is a **portfolio demo**: a complete, working, self-contained app that shows product thinking and clean front-end code. It is **not** a replacement for full property-management platforms (TurboTenant, Innago, Avail, DoorLoop, etc.), and the calculators are planning helpers, **not** legal, tax, or financial advice. It deliberately stores everything locally and connects to nothing.

Ideas for a next version: tenant/property editing in place, CSV import, charts on the dashboard, printable work orders, and a small test suite for the classifier.

---

## 📄 License

[MIT](LICENSE) — free to use, copy, modify, and share. Attribution appreciated but not required.
