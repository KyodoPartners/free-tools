/* ============================================================
   Kyodo Partners — printable results + optional email capture.

   ONE file, included on the 16 free calculator pages exactly the way
   kp-analytics.js is:   <script src="/kp-capture.js" defer></script>

   WHAT IT DOES
   1. Adds a "Print / Save as PDF" button so a visitor can take their
      results to a lender, a spouse, or an accountant. Free, instant,
      no email required, done entirely inside the browser.
   2. Adds an OPTIONAL email box underneath it, offering the matching
      written guide plus a heads-up when the paid workbook launches.
   3. Posts a submitted address to the same Google Form / Google Sheet
      the contact page already uses, so there is no new account, no new
      vendor, and no monthly cost.

   PRIVACY — READ BEFORE CHANGING ANYTHING HERE
   The site promises "no sign-up, your numbers never leave your device."
   That promise is kept, deliberately:
     - Printing is 100% client-side. Nothing is transmitted.
     - The ONLY field ever sent is the email address the visitor types,
       plus which page they were on. The numbers they entered into the
       calculator are NEVER read, NEVER stored, and NEVER transmitted.
     - The email box is visibly optional and the tool works fully
       without it. Do NOT turn this into a gate that withholds results
       until an address is given — that would make the promise a lie.

   SECURITY
   Every element is built with createElement + textContent. No innerHTML
   anywhere, so there is no injection path (site standing rule, June 18).
   No eval, no third-party script, no cookies.
   ============================================================ */
(function () {
  "use strict";

  // Same Google Form endpoint + field IDs the contact page posts to.
  var ACTION = "https://docs.google.com/forms/d/e/1FAIpQLSeO95vH7vtEz9ZbOGha9OOaTVl-A0BQlBrziWHoK739N1aoRg/formResponse";
  var F_NAME    = "entry.1625174236";
  var F_EMAIL   = "entry.1109004830";
  var F_TOPIC   = "entry.422631737";   // must be one of: Sales | Support | Other
  var F_PRODUCT = "entry.1549571152";
  var F_MESSAGE = "entry.1380285002";

  var DONE_KEY = "kp_guide_signup_v1";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function ev(name, params) {
    if (window.gtag) window.gtag("event", name, params || {});
  }

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text) n.textContent = text;
    return n;
  }

  /* Which tool is this? Read the slug off the existing buy link so the
     captured address records which calculator the person was using. */
  function toolSlug() {
    var a = document.querySelector(".kpb-buy, a[href*='gumroad.com/l/']");
    var href = a ? (a.getAttribute("href") || "") : "";
    var m = href.match(/\/l\/([A-Za-z0-9_-]+)/);
    if (m) return m[1];
    var f = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
    return f || "unknown";
  }

  /* Hide page chrome when printing so the printout is just the numbers. */
  function injectPrintCss() {
    // NOTE: the two page families use different class names —
    // breakeven-*.html use <header class="kp"> / <footer class="kp">,
    // the five main calculators use .kp-header / .kp-footer. Hide both.
    // The orange buy box (.kpb-wrap and friends) must never print: a
    // customer handing these numbers to a lender should not be handing
    // over our sales pitch too.
    var css =
      "@media print{" +
        "html,body{background:#fff !important;}" +
        "header.kp,header.kp-header,.kp-header,.kp-footer,footer.kp,footer.kp-footer," +
          ".kpb-sticky,.kpb-wrap,.kpb-card,.kpb-buyzone,.kpb-buy," +
          "#kpCapture,nav,.kp-nav,.kp-btn,.kp-link{display:none !important;}" +
        "a[href]:after{content:'' !important;}" +
        "*{box-shadow:none !important;}" +
        ".card,.box,section,table,.r-card{break-inside:avoid;page-break-inside:avoid;}" +
        "#kpPrintStamp{display:block !important;font:11px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#555;" +
          "border-bottom:1px solid #ccc;padding-bottom:6px;margin-bottom:14px;}" +
      "}" +
      "#kpPrintStamp{display:none;}";
    var s = document.createElement("style");
    s.setAttribute("type", "text/css");
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* A small "printed from" line that only appears on paper.
     Deliberately does NOT repeat the page title — the browser already
     prints its own header with the title and date. */
  function injectPrintStamp() {
    var stamp = el("div", null,
      "kyodopartners.com  ·  printed " + new Date().toLocaleDateString() +
      "  ·  Planning helper — not legal, tax, accounting, or financial advice.");
    stamp.id = "kpPrintStamp";
    if (document.body.firstChild) {
      document.body.insertBefore(stamp, document.body.firstChild);
    } else {
      document.body.appendChild(stamp);
    }
  }

  function styleBlock() {
    var css =
      "#kpCapture{max-width:900px;margin:26px auto 30px;padding:18px 20px;border:1px solid #d7e4d9;" +
        "border-radius:12px;background:#f6faf7;font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}" +
      "#kpCapture h3{margin:0 0 4px;font-size:1.05rem;color:#166534;}" +
      "#kpCapture .kpc-sub{margin:0 0 14px;color:#4b5563;font-size:.92rem;}" +
      "#kpCapture .kpc-print{display:inline-block;background:#166534;color:#fff;border:0;border-radius:9px;" +
        "padding:11px 18px;font-weight:700;font-size:.95rem;cursor:pointer;}" +
      "#kpCapture .kpc-print:hover{background:#14532d;}" +
      "#kpCapture .kpc-rule{border:0;border-top:1px solid #e2ebe4;margin:16px 0 14px;}" +
      "#kpCapture .kpc-optional{display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.04em;" +
        "text-transform:uppercase;color:#166534;background:#dcfce7;border-radius:999px;padding:2px 9px;margin-bottom:7px;}" +
      "#kpCapture label{display:block;font-weight:600;margin:0 0 6px;color:#111827;font-size:.95rem;}" +
      "#kpCapture .kpc-row{display:flex;flex-wrap:wrap;gap:9px;}" +
      "#kpCapture input[type=email]{flex:1 1 240px;min-width:0;padding:10px 12px;border:1px solid #cbd5cf;" +
        "border-radius:9px;font-size:.95rem;background:#fff;}" +
      "#kpCapture input[type=email]:focus{outline:2px solid #15803D;outline-offset:1px;}" +
      "#kpCapture .kpc-send{background:#15803D;color:#fff;border:0;border-radius:9px;padding:10px 18px;" +
        "font-weight:700;font-size:.95rem;cursor:pointer;}" +
      "#kpCapture .kpc-send:hover{background:#166534;}" +
      "#kpCapture .kpc-opt{display:flex;gap:8px;align-items:flex-start;margin:12px 0 0;font-weight:400;" +
        "font-size:.88rem;color:#374151;cursor:pointer;line-height:1.45;}" +
      "#kpCapture .kpc-opt input{margin:2px 0 0;flex:0 0 auto;width:16px;height:16px;accent-color:#166534;cursor:pointer;}" +
      "#kpCapture .kpc-fine{margin:9px 0 0;font-size:.82rem;color:#6b7280;}" +
      "#kpCapture .kpc-err{margin:8px 0 0;font-size:.86rem;color:#b91c1c;}" +
      "#kpCapture .kpc-thanks{margin:0;color:#166534;font-weight:600;}";
    var s = document.createElement("style");
    s.setAttribute("type", "text/css");
    s.textContent = css;
    document.head.appendChild(s);
  }

  function alreadySignedUp() {
    try { return window.localStorage.getItem(DONE_KEY) === "1"; }
    catch (e) { return false; }
  }
  function rememberSignup() {
    try { window.localStorage.setItem(DONE_KEY, "1"); } catch (e) {}
  }

  /* Print-only pages: show the Print / Save button but NO email form.
     Used where the email offer (a guide / paid workbook) does not exist or
     does not fit, e.g. the lottery educator page. A page opts in with
     <meta name="kp-capture" content="print-only">, or by being listed here. */
  var PRINT_ONLY_PAGES = ["lottery-odds-calculator"];
  function isPrintOnly() {
    var m = document.querySelector('meta[name="kp-capture"]');
    if (m && /print-only/i.test(m.getAttribute("content") || "")) return true;
    var f = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
    return PRINT_ONLY_PAGES.indexOf(f) !== -1;
  }

  function build() {
    var slug = toolSlug();
    var printOnly = isPrintOnly();

    var wrap = el("section");
    wrap.id = "kpCapture";
    wrap.setAttribute("aria-label", printOnly ? "Print your results" : "Print your results or request the written guide");

    wrap.appendChild(el("h3", null, "Take your results with you"));
    wrap.appendChild(el("p", "kpc-sub", printOnly
      ? "Print this page or save it as a PDF to keep your results. Nothing is uploaded — the file is made right here in your browser."
      : "Print this page or save it as a PDF so you can hand the numbers to a lender, " +
        "a partner, or your accountant. Nothing is uploaded — the file is made right here in your browser."));

    var printBtn = el("button", "kpc-print", "🖨  Print / Save as PDF");
    printBtn.type = "button";
    printBtn.addEventListener("click", function () {
      ev("print_results", { tool: slug, page_path: location.pathname });
      window.print();
    });
    wrap.appendChild(printBtn);

    if (printOnly || alreadySignedUp()) return wrap;

    wrap.appendChild(el("hr", "kpc-rule"));

    var badge = el("span", "kpc-optional", "Optional");
    wrap.appendChild(badge);

    var form = el("form");
    form.setAttribute("novalidate", "novalidate");

    var lab = el("label", null, "Want this guide emailed to you to read later?");
    lab.setAttribute("for", "kpcEmail");
    form.appendChild(lab);

    var row = el("div", "kpc-row");
    var input = el("input");
    input.type = "email";
    input.id = "kpcEmail";
    input.placeholder = "you@example.com";
    input.setAttribute("autocomplete", "email");
    row.appendChild(input);

    var send = el("button", "kpc-send", "Send it to me");
    send.type = "submit";
    row.appendChild(send);
    form.appendChild(row);

    /* Opt-in for anything beyond the one guide they asked for.
       Unchecked by default — an opt-in that starts checked is not consent. */
    var optWrap = el("label", "kpc-opt");
    var optBox = el("input");
    optBox.type = "checkbox";
    optBox.id = "kpcOptIn";
    optWrap.appendChild(optBox);
    optWrap.appendChild(el("span", null,
      " Check here if you'd also like other information from Kyodo Partners — " +
      "new free tools and guides as we release them."));
    optWrap.setAttribute("for", "kpcOptIn");
    form.appendChild(optWrap);

    var fine = el("p", "kpc-fine",
      "Only your email address is sent — the numbers you typed above never leave your device. " +
      "We never sell, rent, or share your email address with anyone. " +
      "You can ask us to delete it at any time and we will.");
    form.appendChild(fine);

    var err = el("p", "kpc-err");
    err.style.display = "none";
    form.appendChild(err);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var value = (input.value || "").trim();
      // Deliberately permissive: a real address we can't parse beats a
      // rejected customer. Just require something that looks like a@b.c
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        err.textContent = "That doesn't look like an email address — mind checking it?";
        err.style.display = "block";
        input.focus();
        return;
      }
      err.style.display = "none";
      send.disabled = true;
      send.textContent = "Sending…";

      var body = new URLSearchParams();
      body.append(F_NAME, "(guide request)");
      body.append(F_EMAIL, value);
      body.append(F_TOPIC, "Other");
      body.append(F_PRODUCT, slug);
      var wantsMore = !!(optBox && optBox.checked);
      body.append(F_MESSAGE,
        "Guide request from the free " + slug + " calculator (" + location.pathname + "). " +
        "Consent to other Kyodo Partners information: " + (wantsMore ? "YES" : "no") + ".");

      function finish() {
        ev("email_capture", { tool: slug, page_path: location.pathname });
        rememberSignup();
        var thanks = el("p", "kpc-thanks",
          "Thanks — the guide is on its way to " + value + ". Nothing else was sent.");
        form.replaceWith(thanks);
        badge.style.display = "none";
      }

      if (window.fetch) {
        fetch(ACTION, { method: "POST", mode: "no-cors", body: body }).finally(finish);
      } else {
        finish();
      }
    });

    wrap.appendChild(form);
    return wrap;
  }

  ready(function () {
    if (document.getElementById("kpCapture")) return; // never double-inject
    var anchor = document.querySelector("footer.kp-footer, footer.kp, footer");
    if (!anchor || !anchor.parentNode) return;        // unknown layout: do nothing
    styleBlock();
    injectPrintCss();
    injectPrintStamp();
    anchor.parentNode.insertBefore(build(), anchor);
  });
})();
