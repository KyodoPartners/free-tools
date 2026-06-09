# KyodoPartners · free-tools

Free, open-source tools we build and give away to the community.
Everything here runs in a normal web browser — no install, no account, no server.

---

## Tools in this repo

### 🏠 RentalDesk Robot
A landlord dashboard. Paste a tenant's message and it sorts the request, checks
warranties, drafts a reply, tracks rent, and exports everything to real Excel files.

- **Live demo:** https://kyodopartners.github.io/free-tools/rentaldesk-robot/
- **Code:** the [`rentaldesk-robot`](rentaldesk-robot) folder

---

## How to help make these better

You don't need to be a developer. Here are three ways to pitch in, easiest first.

**1. Have an idea, or found a bug? Open an Issue.**
Click the **Issues** tab at the top of this page, then **New issue**. Describe what
you'd change or what's broken (with steps, if it's a bug). No code required — for most
people this is the single most helpful thing you can do.

**2. Fix wording or small text right here on GitHub.**
Open the file you want to change and click the **pencil (Edit)** icon. Make your edit,
scroll down, add a short note like "fix typo on dashboard," and click **Commit changes**.
The live site updates on its own within a minute or two.

**3. Make a bigger change (more technical).**
Clone the repo, edit the files inside `rentaldesk-robot/`, test by opening `index.html`
in your browser, then commit and push — or open a Pull Request so a teammate can review
it first.

---

## How to test a change

- **Quickest:** after your change deploys (about 1–2 minutes), open the live demo link above.
- **On your computer:** download the `rentaldesk-robot` folder and double-click
  `index.html`. It runs entirely in your browser — nothing to install.

---

## What's inside RentalDesk Robot (so you know where to look)

- `rentaldesk-robot/index.html` — the page itself: header, menu, and the Excel buttons.
- `rentaldesk-robot/styles.css` — all the colors, fonts, and layout.
- `rentaldesk-robot/app.js` — the brain: reads tenant messages, matches warranties, runs the calculators, handles Excel import/export.
- `rentaldesk-robot/README.md` — the tool's own description.

---

## Ground rules

- **Keep it free and open.** These tools are gifts to the community.
- **No secrets or real personal data** in the code — the demo data is made up on purpose.
- **Be kind** in issues and reviews.

---

## License

Released under the MIT License (see `rentaldesk-robot/LICENSE`) — free to use, copy, and adapt.
