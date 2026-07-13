/* ============================================================
   Kyodo Partners — site analytics + funnel events (one place to edit).
   Answers: unique visitors, pages viewed, where visitors drop off,
   are people using the calculator but not buying, and outbound buy-clicks.

   >>> ONE-TIME SETUP (VP): paste your Google Analytics 4 Measurement ID below.
       Get it free at analytics.google.com  (Admin -> Data Streams -> Web -> "G-XXXXXXXXXX").
       Until a real ID is set, nothing loads and no data is collected. <<<
   ============================================================ */
(function () {
  "use strict";
  var GA_ID = "G-MNR4QMXD78"; // Kyodo Partners GA4 Measurement ID (set 2026-07-12)

  var configured = GA_ID && GA_ID.indexOf("XXXX") === -1;

  // --- load Google Analytics 4 (only once a real ID is set) ---
  if (configured) {
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { anonymize_ip: true });
  }

  function ev(name, params) {
    if (window.gtag) window.gtag("event", name, params || {});
  }

  // --- funnel event 1: visitor actually engages the calculator (first input) ---
  var used = false;
  function markUsed() {
    if (used) return;
    used = true;
    ev("calculator_used", { page_path: location.pathname });
  }
  document.addEventListener("input", markUsed, true);
  document.addEventListener("change", markUsed, true);

  // --- funnel event 2: visitor clicks through to buy (any Gumroad/product link) ---
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (/gumroad\.com|\/l\//i.test(href)) {
      ev("buy_click", { link_url: href, page_path: location.pathname });
    }
  }, true);
})();
