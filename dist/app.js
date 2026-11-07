"use strict";
const $ = (id) => document.getElementById(id);
const money = (n) => "₹" + Number(n).toLocaleString("en-IN");
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (s) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        s
      ],
  );
const products = Object.fromEntries(catalogue.map((p) => [p.product_id, p]));
const profiles = {
  clinic: {
    name: "Harmony Dental Care",
    type: "office",
    employees: 5,
    sites: 1,
    tier: "1",
    gst: "yes",
    needs:
      "Reliable internet and work email for five people at our dental clinic.",
    hi: "हमारे क्लिनिक के पाँच लोगों के लिए भरोसेमंद इंटरनेट और काम का ईमेल चाहिए।",
  },
  salon: {
    name: "Neighbourhood Salon",
    type: "retail",
    employees: 3,
    sites: 1,
    tier: "2",
    gst: "no",
    needs:
      "We need AirFiber, a billing counter and WhatsApp Business API for our salon.",
    hi: "हमें सैलून के लिए एयरफाइबर, बिलिंग काउंटर और WhatsApp Business API चाहिए।",
  },
};
const namesHi = [
  "बिज़ फ़ाइबर 100",
  "बिज़ फ़ाइबर 300",
  "बिज़ फ़ाइबर 1G",
  "5G एयरफाइबर 100",
  "समर्पित इंटरनेट लाइन 20",
  "समर्पित इंटरनेट लाइन 100",
  "बिज़नेस मोबाइल 299",
  "बिज़नेस मोबाइल 599",
  "बैकअप 4G/5G",
  "मैनेज्ड SD-WAN",
  "स्टैटिक IP",
  "क्लाउड टेलीफ़ोनी",
  "टोल-फ़्री नंबर",
  "बिज़नेस SMS",
  "WhatsApp Business API",
  "क्लाउड ईमेल और ऑफिस",
  "क्लाउड बैकअप 1 TB",
  "वेबसाइट और डोमेन",
  "क्लाउड POS और बिलिंग",
  "डिवाइस सुरक्षा",
  "मैनेज्ड फ़ायरवॉल",
  "सुरक्षित गेस्ट वाई-फ़ाई",
  "क्लाउड CCTV",
  "मशीन मॉनिटरिंग",
  "फ़्लीट ट्रैकर",
];
const S = {
  lang: "en",
  step: 0,
  seed: "clinic",
  form: {},
  items: {},
  requested: [],
  declined: [],
  consent: false,
  aux: {},
  verified: null,
  error: "",
  busy: false,
  model: false,
  explanation: "",
  alternatives: null,
  ticket: "",
  receiptReview: false,
  health: { ok: false, ocr: false, model: false },
};
const tr = (en, hi) => (S.lang === "hi" ? hi : en);
const pname = (p) =>
  S.lang === "hi" ? namesHi[Number(p.product_id.slice(1)) - 1] : p.product_name;
const byId = (id) => pname(products[id]);
const needsRules = [
  ["P15", /whatsapp|वॉट्सऐप|व्हाट्सऐप/i],
  ["P16", /e-?mail|mailbox|office suite|ईमेल|मेल/i],
  ["P19", /billing|\bpos\b|बिलिंग|काउंटर/i],
  [
    "P09",
    /failover|redundan|backup (?:internet|link|connection)|बैकअप इंटरनेट/i,
  ],
  ["P17", /storage|backup (?:file|data)|स्टोरेज|डेटा बैकअप/i],
  ["P20", /antivirus|endpoint|device security|एंटीवायरस/i],
  ["P23", /camera|cctv|कैमरा/i],
  ["P22", /guest|अतिथि/i],
  ["P12", /ivr|telephony|टेलीफ़ोन/i],
  ["P11", /static ip|स्टैटिक/i],
  ["P10", /sd.?wan|central management/i],
  ["P24", /machine monitoring|मशीन/i],
  ["P25", /fleet|फ़्लीट/i],
  ["P07", /\bsims?\b|postpaid|mobile plan|मोबाइल प्लान/i],
  ["P13", /toll.?free|टोल.?फ्री/i],
  ["P14", /\bsms\b|एसएमएस/i],
  ["P18", /website|domain name|वेबसाइट/i],
  ["P21", /firewall|फ़ायरवॉल/i],
];
function reset(seed) {
  S.seed = seed;
  S.form = { ...profiles[seed] };
  S.form.needs = S.lang === "hi" ? S.form.hi : S.form.needs;
  Object.assign(S, {
    step: 0,
    items: {},
    requested: [],
    declined: [],
    consent: false,
    aux: {},
    verified: null,
    error: "",
    busy: false,
    model: false,
    explanation: "",
    alternatives: null,
    ticket: "",
    receiptReview: false,
  });
}
function reason(id, selection = S.items) {
  const p = products[id],
    f = S.form;
  if (!p.available_city_tiers.split(";").includes(f.tier))
    return tr("Unavailable in this city tier", "इस शहर श्रेणी में उपलब्ध नहीं");
  if (+f.employees < +p.min_employees)
    return tr(
      "Requires at least " + p.min_employees + " employees",
      "कम से कम " + p.min_employees + " कर्मचारी चाहिए",
    );
  if (+f.sites < +p.min_sites)
    return tr(
      "Requires at least " + p.min_sites + " locations",
      "कम से कम " + p.min_sites + " स्थान चाहिए",
    );
  if (p.requires_gstin === "Y" && f.gst !== "yes")
    return tr(
      "An active GST registration is required",
      "सक्रिय GST पंजीकरण चाहिए",
    );
  if (
    p.requires_one_of &&
    !p.requires_one_of.split("|").some((k) => selection[k])
  )
    return tr(
      "Add a compatible connection first",
      "पहले उपयुक्त इंटरनेट कनेक्शन चुनें",
    );
  return "";
}
function suggest() {
  const f = S.form,
    s = f.needs;
  const wants = needsRules.filter((x) => x[1].test(s)).map((x) => x[0]);
  const mobileOnly = /only.{0,15}(sim|mobile)|सिर्फ.{0,15}मोबाइल/i.test(s);
  let base = /airfiber|airfibre|wireless|एयरफाइबर/i.test(s)
    ? "P04"
    : /leased|dedicated|लीज़्ड/i.test(s)
      ? "P05"
      : /1\s?g(b|iga)|गीगाबिट/i.test(s)
        ? "P03"
        : f.type === "retail"
          ? "P01"
          : "P02";
  if (mobileOnly) base = "P07";
  S.requested = [...new Set([base, ...wants])];
  S.declined = [];
  S.items = {};
  for (const id of S.requested) {
    if (reason(id)) {
      S.declined.push(id);
      if (id === base && id !== "P01") S.items.P01 = +f.sites;
      continue;
    }
    S.items[id] = quantity(id);
  }
}
function quantity(id) {
  const p = products[id];
  return p.unit === "per site"
    ? +S.form.sites
    : p.unit === "per user"
      ? +S.form.employees
      : 1;
}
function totals() {
  const lines = Object.entries(S.items).map(([id, q]) => [products[id], q]);
  return {
    monthly: lines.reduce((a, [p, q]) => a + q * +p.price_min_inr_per_month, 0),
    setup: lines.reduce((a, [p, q]) => a + q * +p.one_time_setup_inr, 0),
    months: Math.max(0, ...lines.map(([p]) => +p.min_contract_months)),
    days: Math.max(0, ...lines.map(([p]) => +p.typical_install_days)),
  };
}
const B = (id, label, cls = "cta", disabled = false) =>
  '<button type="button" id="' +
  id +
  '" class="' +
  cls +
  '" ' +
  (disabled ? "disabled" : "") +
  ">" +
  label +
  "</button>";
const title = (over, name, sub) =>
  '<p class="over">' +
  over +
  "</p><h1>" +
  name +
  '</h1><p class="lead">' +
  sub +
  "</p>";
const info = (en, hi) => '<p class="info">' + tr(en, hi) + "</p>";
const opt = (v, s, k) =>
  '<option value="' +
  v +
  '" ' +
  (v === k ? "selected" : "") +
  ">" +
  s +
  "</option>";
function refresh(scroll = false) {
  document.documentElement.lang = S.lang;
  $("en").setAttribute("aria-pressed", S.lang === "en");
  $("hi").setAttribute("aria-pressed", S.lang === "hi");
  const labels = [
    tr("Needs", "ज़रूरत"),
    tr("Quote", "कोटेशन"),
    tr("Verify", "जाँच"),
    tr("Track", "स्थिति"),
  ];
  $("steps").innerHTML = labels
    .map(
      (l, i) =>
        (i ? '<span class="chev" aria-hidden="true">›</span>' : "") +
        '<button type="button" id="step-' +
        i +
        '" class="step ' +
        (i === S.step ? "active" : i < S.step ? "done" : "") +
        '" ' +
        (i === S.step ? 'aria-current="step"' : "") +
        " " +
        (i >= S.step || S.step === 3 || S.busy ? "disabled" : "") +
        "><i>" +
        (i < S.step ? "✓" : i + 1) +
        "</i>" +
        l +
        "</button>",
    )
    .join("");
  labels.forEach((_, i) => {
    if (i < S.step && S.step !== 3)
      $("step-" + i).onclick = () => {
        S.step = i;
        S.verified = null;
        S.consent = false;
        S.aux = {};
        S.error = "";
        refresh(true);
      };
  });
  [needsView, quoteView, verifyView, trackView][S.step]();
  $("footer").innerHTML =
    "<span>" +
    tr(
      "Accel Business · Synthetic hackathon demo",
      "एक्सेल बिज़नेस · काल्पनिक हैकाथॉन डेमो",
    ) +
    "</span><span>" +
    tr(
      "Catalogue prices before tax · No payment collected",
      "कर से पहले की कीमतें · भुगतान नहीं लिया जाता",
    ) +
    "</span>";
  if (scroll) window.scrollTo({ top: 0, behavior: "instant" });
}
function visits() {
  return ["clinic", "salon"]
    .map(
      (key) =>
        '<button class="scenario" type="button" id="use-' +
        key +
        '" aria-pressed="' +
        (S.seed === key) +
        '"><span><b>' +
        (key === "clinic"
          ? tr("Dental clinic", "डेंटल क्लिनिक")
          : tr("Neighbourhood salon", "स्थानीय सैलून")) +
        "</b><br>" +
        (key === "clinic"
          ? tr("Five people · One location", "पाँच कर्मचारी · एक स्थान")
          : tr("No GST registration", "GST पंजीकरण नहीं")) +
        '</span><span aria-hidden="true">' +
        (S.seed === key ? "●" : "→") +
        "</span></button>",
    )
    .join("");
}
function needsView() {
  const f = S.form;
  $("main").innerHTML =
    title(
      tr("Bundle advisor", "बंडल सलाहकार"),
      tr("What does your business need?", "आपके व्यवसाय को क्या चाहिए?"),
      tr(
        "Tell us about your workplace. We’ll check which services fit and show you the full commitment.",
        "अपने कार्यस्थल की जानकारी दें। हम उपयुक्त सेवाएँ, कीमत और अवधि दिखाएँगे।",
      ),
    ) +
    '<div class="layout"><form class="card" id="needs-form"><div class="headrow"><h2>' +
    tr("Your workplace", "आपका कार्यस्थल") +
    "</h2><small>" +
    tr("Step 1 of 4", "चरण 1 / 4") +
    '</small></div><div class="fields two"><label class="field">' +
    tr("Business name", "व्यवसाय का नाम") +
    '<input id="name" required maxlength="100" value="' +
    esc(f.name) +
    '"></label><label class="field">' +
    tr("Business type", "व्यवसाय का प्रकार") +
    '<select id="type">' +
    [
      ["office", tr("Professional office", "पेशेवर कार्यालय")],
      ["retail", tr("Retail & services", "दुकान और सेवाएँ")],
      ["multi", tr("Multi-site business", "कई स्थान वाला व्यवसाय")],
      ["manufacturing", tr("Manufacturing", "निर्माण")],
    ]
      .map(([v, s]) => opt(v, s, f.type))
      .join("") +
    '</select></label></div><div class="fields"><label class="field">' +
    tr("Employees", "कर्मचारी") +
    '<input id="employees" type="number" min="1" max="999" required value="' +
    f.employees +
    '"></label><label class="field">' +
    tr("Locations", "स्थान") +
    '<input id="sites" type="number" min="1" max="999" required value="' +
    f.sites +
    '"></label><label class="field">' +
    tr("City tier", "शहर की श्रेणी") +
    '<select id="tier">' +
    ["1", "2"].map((v) => opt(v, tr("Tier ", "श्रेणी ") + v, f.tier)).join("") +
    '</select></label></div><label class="field">' +
    tr("Active GST registration?", "सक्रिय GST पंजीकरण है?") +
    '<select id="gst">' +
    opt("yes", tr("Yes, verify at checkout", "हाँ, चेकआउट पर जाँचें"), f.gst) +
    opt("no", tr("No / unsure", "नहीं / पता नहीं"), f.gst) +
    '</select></label><div class="section"><label class="field">' +
    tr("What would you like to do?", "आपको कौन सा काम करना है?") +
    '<textarea required maxlength="600" id="needs">' +
    esc(f.needs) +
    '</textarea></label></div><div class="ctas"><button class="cta" id="advise">' +
    tr("Find my bundle →", "मेरा बंडल दिखाएँ →") +
    '</button></div></form><aside class="aside"><p class="caps">' +
    tr("Demo profiles", "डेमो प्रोफ़ाइल") +
    "</p><h2>" +
    tr("Try a purchase", "खरीद का अनुभव देखें") +
    "</h2>" +
    visits() +
    '<div class="section">' +
    info(
      "Use fictional business details. Documents are requested only during verification.",
      "काल्पनिक व्यावसायिक विवरण दें। दस्तावेज़ केवल जाँच के समय माँगे जाते हैं।",
    ) +
    "</div></aside></div>";
  ["clinic", "salon"].forEach(
    (k) =>
      ($("use-" + k).onclick = () => {
        reset(k);
        refresh();
      }),
  );
  $("needs-form").onsubmit = async (ev) => {
    ev.preventDefault();
    readForm();
    suggest();
    S.explanation = "";
    S.model = false;
    S.alternatives = null;
    S.step = 1;
    refresh(true);
  };
}
function readForm() {
  for (const key of [
    "name",
    "type",
    "employees",
    "sites",
    "tier",
    "gst",
    "needs",
  ])
    if ($(key)) S.form[key] = $(key).value.trim();
}
function productLine(id) {
  const p = products[id],
    selected = Boolean(S.items[id]),
    blocked = reason(id),
    q = S.items[id] || quantity(id);
  return (
    '<div class="product"><input type="checkbox" id="toggle-' +
    id +
    '" ' +
    (selected ? "checked " : "") +
    (blocked ? "disabled " : "") +
    'aria-label="' +
    esc(pname(p)) +
    '"><div><label for="toggle-' +
    id +
    '">' +
    esc(pname(p)) +
    '</label><p class="info">' +
    esc(blocked || productDetail(p)) +
    '</p></div><div class="right">' +
    money(+p.price_min_inr_per_month * q) +
    '<div class="qty"><label for="qty-' +
    id +
    '">' +
    tr("Qty", "मात्रा") +
    '</label><input id="qty-' +
    id +
    '" aria-label="' +
    esc(tr("Quantity for ", "मात्रा ") + pname(p)) +
    '" type="number" min="1" max="999" value="' +
    q +
    '" ' +
    (!selected ? "disabled" : "") +
    "></div></div></div>"
  );
}
function productDetail(p) {
  const units = {
    "per site": "प्रति स्थान",
    "per user": "प्रति उपयोगकर्ता",
    "per line": "प्रति लाइन",
    "per device": "प्रति डिवाइस",
    "per counter": "प्रति काउंटर",
    "per account": "प्रति खाता",
    "per IP": "प्रति IP",
    "per pack": "प्रति पैक",
    "per channel": "प्रति चैनल",
    "per number": "प्रति नंबर",
    "per camera": "प्रति कैमरा",
    "per vehicle": "प्रति वाहन",
  };
  return (
    money(p.price_min_inr_per_month) +
    " " +
    tr(p.unit, units[p.unit] || p.unit) +
    " · " +
    tr("setup ", "सेटअप ") +
    money(p.one_time_setup_inr)
  );
}
function summary(button) {
  const t = totals();
  let row = (l, r) =>
    '<div class="cost"><span>' + l + "</span><b>" + r + "</b></div>";
  return (
    '<aside class="aside summary"><span class="caps">' +
    tr("Your monthly quote", "आपका मासिक कोटेशन") +
    '</span><div class="sum" id="monthly">' +
    money(t.monthly) +
    "</div>" +
    info("per month, before taxes", "प्रति माह, कर से पहले") +
    '<div class="section" style="border:0;padding:0">' +
    row(tr("One-time setup", "एक बार का सेटअप"), money(t.setup)) +
    row(
      tr("First month + setup", "पहला महीना + सेटअप"),
      money(t.monthly + t.setup),
    ) +
    row(
      tr("Longest minimum term", "सबसे लंबी न्यूनतम अवधि"),
      t.months + " " + tr("months", "महीने"),
    ) +
    row(
      tr("Typical longest install", "सामान्य अधिकतम इंस्टॉल"),
      t.days + " " + tr("days", "दिन"),
    ) +
    "</div>" +
    info(
      "Installation depends on the site check.",
      "इंस्टॉलेशन स्थान की जाँच पर निर्भर है।",
    ) +
    (button
      ? B(
          "checkout",
          tr("Accept quote & verify →", "स्वीकार करें और जाँचें →"),
          "cta",
          !t.monthly || S.busy,
        )
      : "") +
    "</aside>"
  );
}
function alternativesView() {
  if (!S.health.model) return "";
  const result = S.alternatives;
  const choices =
    result?.ids
      ?.map(
        (id) =>
          '<div class="headrow section"><span>' +
          esc(byId(id)) +
          " · " +
          money(products[id].price_min_inr_per_month) +
          " / " +
          esc(tr(products[id].unit, "इकाई")) +
          "</span>" +
          B("add-suggestion-" + id, tr("Add", "जोड़ें"), "ghost", S.busy) +
          "</div>",
      )
      .join("") || "";
  return (
    '<section class="card"><h2>' +
    tr("Other options for your needs", "आपकी ज़रूरत के अन्य विकल्प") +
    "</h2>" +
    info(
      "Ask the on-device model for alternatives from the eligible catalogue. They change the quote only when you add one.",
      "स्थानीय मॉडल से पात्र कैटलॉग के अन्य विकल्प माँगें। कीमत तभी बदलेगी जब आप कोई विकल्प जोड़ेंगे।",
    ) +
    (result
      ? '<p class="info" role="status">' + esc(result.explanation) + "</p>"
      : "") +
    choices +
    '<div class="ctas">' +
    B(
      "ai-options",
      tr("Suggest alternatives", "अन्य विकल्प सुझाएँ"),
      "ghost",
      S.busy,
    ) +
    "</div></section>"
  );
}
async function aiOptions() {
  const eligible = Object.keys(products).filter(
    (id) => !S.items[id] && !reason(id),
  );
  if (!eligible.length) return;
  S.busy = true;
  S.alternatives = null;
  refresh();
  try {
    const r = await api(
      "advice",
      { needs: S.form.needs, language: S.lang, eligibleIds: eligible },
      65000,
    );
    const ids = [
      ...new Set((r.productIds || []).filter((id) => eligible.includes(id))),
    ].slice(0, 3);
    if (!r.ok || !ids.length) throw Error();
    S.alternatives = { ids, explanation: r.explanation };
  } catch {
    S.alternatives = {
      ids: [],
      explanation: tr(
        "The local model could not return an alternative. You can still explore the catalogue above.",
        "स्थानीय मॉडल अन्य विकल्प नहीं दे पाया। ऊपर कैटलॉग देखें।",
      ),
    };
  } finally {
    S.busy = false;
    refresh();
  }
}
function quoteView() {
  const selected = Object.keys(S.items),
    featured = [
      ...new Set([
        ...S.requested.filter((id) => !S.declined.includes(id)),
        ...selected,
        ...(S.form.type === "retail" ? ["P18", "P07"] : ["P09", "P17"]),
      ]),
    ];
  const other = Object.keys(products).filter(
    (k) => !featured.includes(k) && !S.declined.includes(k),
  );
  const description = selected.map((id) => byId(id)).join(" + ");
  $("main").innerHTML =
    title(
      tr("Quote & checkout", "कोटेशन और चेकआउट"),
      tr("Your business bundle", "आपका बिज़नेस बंडल"),
      esc(S.form.name) +
        " · " +
        tr(
          "Adjust the services and quantities before you commit.",
          "खरीदने से पहले सेवाएँ और मात्रा बदलें।",
        ),
    ) +
    '<div class="layout"><div class="stack">' +
    (S.declined.length
      ? '<div class="hint"><strong>' +
        tr(
          "Some requested services need a different profile",
          "कुछ सेवाओं के लिए अलग पात्रता चाहिए",
        ) +
        "</strong>" +
        S.declined
          .map(
            (id) =>
              esc(byId(id)) +
              " · " +
              esc(reason(id) || tr("Review availability", "उपलब्धता जाँचें")),
          )
          .join("<br>") +
        "</div>"
      : "") +
    '<section class="card"><div class="headrow"><h2>' +
    tr("Services in your quote", "आपकी चुनी हुई सेवाएँ") +
    "</h2><small>" +
    tr("Monthly rates", "मासिक शुल्क") +
    "</small></div>" +
    featured.map(productLine).join("") +
    '<details class="choose-more" id="other-options"><summary>' +
    tr("Explore the full catalogue", "पूरा कैटलॉग देखें") +
    "</summary>" +
    other.map(productLine).join("") +
    '</details></section><section class="card"><h2>' +
    tr("Why this fits", "यह क्यों उपयुक्त है") +
    '</h2><p class="info">' +
    (S.explanation ? esc(S.explanation) : localExplanation(description)) +
    '</p><div class="components">' +
    (S.model
      ? tr(
          "Local generative model · eligibility enforced separately",
          "स्थानीय जनरेटिव मॉडल · अलग पात्रता जाँच",
        )
      : tr(
          "Catalogue rules · offline advisor",
          "कैटलॉग नियम · ऑफ़लाइन सलाहकार",
        )) +
    "</div>" +
    (S.health.model
      ? '<div class="ctas">' +
        B(
          "ai-advice",
          S.busy
            ? tr("Reviewing…", "समीक्षा जारी…")
            : tr("Review with local AI", "स्थानीय AI से समीक्षा"),
          "ghost",
          S.busy,
        ) +
        "</div>"
      : "") +
    "</section>" +
    alternativesView() +
    "</div>" +
    summary(true) +
    "</div>";
  const opened = () => $("other-options")?.open;
  for (const id of [...featured, ...other]) {
    $("toggle-" + id).onchange = () => {
      const restore = opened();
      if (S.items[id]) delete S.items[id];
      else S.items[id] = quantity(id);
      for (const key of Object.keys(S.items))
        if (reason(key)) delete S.items[key];
      S.verified = null;
      S.explanation = "";
      S.model = false;
      S.alternatives = null;
      refresh();
      if (restore) $("other-options").open = true;
    };
    $("qty-" + id).onchange = () => {
      if (!S.items[id]) return;
      const restore = opened();
      const n = +$("qty-" + id).value;
      S.items[id] = Math.max(1, Math.min(999, Math.floor(n) || 1));
      S.explanation = "";
      S.model = false;
      S.alternatives = null;
      refresh();
      if (restore) $("other-options").open = true;
    };
  }
  $("checkout").onclick = () => {
    S.step = 2;
    S.verified = null;
    S.consent = false;
    S.aux = {};
    S.error = "";
    refresh(true);
  };
  if ($("ai-advice")) $("ai-advice").onclick = aiAdvice;
  if ($("ai-options")) $("ai-options").onclick = aiOptions;
  for (const id of S.alternatives?.ids || []) {
    const control = $("add-suggestion-" + id);
    if (control)
      control.onclick = () => {
        if (reason(id) || S.items[id]) return;
        S.items[id] = quantity(id);
        S.alternatives = null;
        S.explanation = "";
        S.model = false;
        refresh();
      };
  }
}
function localExplanation(description) {
  if (!description)
    return tr(
      "Select services to see your commitment.",
      "अवधि और लागत देखने के लिए सेवाएँ चुनें।",
    );
  const bits = [];
  if (S.items.P02)
    bits.push(
      tr(
        "300 Mbps fibre provides a fixed connection for your workplace.",
        "300 Mbps फ़ाइबर आपके कार्यालय को स्थायी इंटरनेट देता है।",
      ),
    );
  if (S.items.P04)
    bits.push(
      tr(
        "AirFiber is a wireless connection for sites without fibre.",
        "एयरफाइबर उन स्थानों के लिए वायरलेस कनेक्शन है जहाँ फ़ाइबर नहीं है।",
      ),
    );
  if (S.items.P16)
    bits.push(
      tr(
        "Work email is priced per person, with " +
          S.items.P16 +
          " seats selected.",
        "काम के ईमेल की कीमत प्रति व्यक्ति है। " +
          S.items.P16 +
          " सीटें चुनी गई हैं।",
      ),
    );
  if (S.items.P19)
    bits.push(
      tr(
        "Cloud POS adds billing for the selected counters.",
        "क्लाउड POS चुने हुए काउंटरों की बिलिंग संभालता है।",
      ),
    );
  if (S.items.P09)
    bits.push(
      tr(
        "The backup link keeps a second connection available if the main line fails.",
        "मुख्य लाइन बंद होने पर बैकअप लिंक दूसरा कनेक्शन उपलब्ध रखता है।",
      ),
    );
  return esc(
    bits.join(" ") ||
      tr(
        "The selected services meet the catalogue checks for your stated profile.",
        "आपके बताए गए विवरण के अनुसार चुनी गई सेवाएँ कैटलॉग की पात्रता जाँच पूरी करती हैं।",
      ),
  );
}
async function api(path, data, timeout = 14000) {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), timeout);
  try {
    const res = await fetch("/api/" + path, {
      method: data ? "POST" : "GET",
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      signal: c.signal,
    });
    if (!res.ok) throw Error("Unavailable");
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
async function aiAdvice() {
  const eligible = Object.keys(S.items).filter((id) => !reason(id));
  S.busy = true;
  refresh();
  try {
    const r = await api(
      "advice",
      {
        needs:
          tr(
            "Explain the current selected bundle for this need. ",
            "इस ज़रूरत के लिए चुने गए बंडल की व्याख्या करें। ",
          ) + S.form.needs,
        language: S.lang,
        eligibleIds: eligible,
      },
      65000,
    );
    if (!r.ok || !r.explanation) throw Error();
    S.explanation =
      r.explanation +
      (r.productIds?.length
        ? " " +
          tr("Reviewed services: ", "समीक्षा की गई सेवाएँ: ") +
          r.productIds
            .filter((k) => eligible.includes(k))
            .map(byId)
            .join(", ")
        : "");
    S.model = true;
  } catch {
    S.model = false;
    S.explanation = tr(
      "Local model unavailable. Your catalogue quote is still available.",
      "स्थानीय मॉडल उपलब्ध नहीं है। कैटलॉग कोटेशन उपलब्ध है।",
    );
  } finally {
    S.busy = false;
    refresh();
  }
}
function verifyView() {
  const restricted = Object.keys(S.items).some(
    (k) => products[k].requires_gstin === "Y",
  );
  const fixture =
    S.seed === "clinic" &&
    S.form.name.trim().toLowerCase() === "harmony dental care" &&
    S.form.gst === "yes";
  const seen = S.verified,
    pendingDoc = Object.values(S.aux).some((x) => !x.passed);
  let docArea = "";
  if (S.consent) {
    if (fixture)
      docArea +=
        '<div class="section"><h3>' +
        tr("Try the supplied clinic specimen", "क्लिनिक का नमूना आज़माएँ") +
        "</h3>" +
        info(
          "Use a pre-extracted GST specimen matched to the mock registry.",
          "मॉक रजिस्ट्री से मिलाए गए GST नमूने के पहले से निकाले गए फ़ील्ड देखें।",
        ) +
        B("sample", tr("Use K02 sample", "K02 नमूना देखें"), "ghost", S.busy) +
        "</div>";
    if (S.health.ok)
      docArea +=
        '<div class="section"><h3>' +
        tr("Check a mock registry", "मॉक रजिस्ट्री जाँचें") +
        '</h3><div class="fields two"><label class="field">' +
        tr("Registry", "रजिस्ट्री") +
        '<select id="kind">' +
        opt("gst", "GST", "gst") +
        opt("udyam", tr("Udyam", "उद्यम"), "gst") +
        '</select></label><label class="field">' +
        tr("Synthetic identifier", "काल्पनिक पहचान संख्या") +
        '<input autocomplete="off" id="identifier" maxlength="32"></label></div>' +
        B(
          "lookup",
          tr("Look up identifier", "पहचान की जाँच"),
          "ghost",
          S.busy,
        ) +
        "</div>";
    if (S.health.ocr)
      docArea +=
        '<div class="section"><h3>' +
        tr("Read a specimen image", "नमूने की तस्वीर पढ़ें") +
        "</h3>" +
        info(
          "The local OCR service reads a GST or Udyam specimen and checks the result against the mock registry.",
          "स्थानीय OCR सेवा GST या उद्यम नमूना पढ़कर मॉक रजिस्ट्री से मिलान करती है।",
        ) +
        '<input type="file" accept="image/png,image/jpeg" class="file" id="document" aria-label="' +
        tr("Specimen image", "नमूने की तस्वीर") +
        '"><div class="ctas">' +
        B(
          "extract",
          tr("Extract & check", "पढ़ें और जाँचें"),
          "ghost",
          S.busy,
        ) +
        "</div></div>";
    if (S.health.ocr)
      docArea +=
        '<details class="choose-more section"><summary>' +
        tr(
          "Check an address bill or signatory ID",
          "पते के बिल या हस्ताक्षरकर्ता ID की जाँच",
        ) +
        "</summary>" +
        info(
          "Optional document-date check using the case date, 15 July 2026. Signatory authority and address ownership still require review.",
          "वैकल्पिक तारीख जाँच का आधार 15 जुलाई 2026 है। हस्ताक्षर का अधिकार और पते का स्वामित्व अलग से जाँचना होगा।",
        ) +
        '<label class="field">' +
        tr("Document type", "दस्तावेज़ का प्रकार") +
        '<select id="support-kind">' +
        opt("address", tr("Address bill", "पते का बिल"), "address") +
        opt("signatory", tr("Signatory ID", "हस्ताक्षरकर्ता ID"), "address") +
        '</select></label><div class="ctas"><input type="file" accept="image/png,image/jpeg" class="file" id="support-document" aria-label="' +
        tr("Supporting specimen", "सहायक दस्तावेज़") +
        '">' +
        B(
          "support-check",
          tr("Check document date", "तारीख जाँचें"),
          "ghost",
          S.busy,
        ) +
        "</div></details>";
    for (const [kind, out] of Object.entries(S.aux))
      docArea +=
        '<p class="alert ' +
        (out.passed ? "" : "error") +
        '" role="status"><b>' +
        (kind === "address"
          ? tr("Address bill", "पते का बिल")
          : tr("Signatory ID", "हस्ताक्षरकर्ता ID")) +
        "</b> · " +
        esc(out.label) +
        "</p>";
    if (!S.health.ok && !fixture)
      docArea +=
        '<div class="hint">' +
        tr(
          "Registry lookup is available in the local server demo. You can request a document review for eligible services.",
          "स्थानीय सर्वर डेमो में रजिस्ट्री जाँच उपलब्ध है। पात्र सेवाओं के लिए दस्तावेज़ समीक्षा भेजें।",
        ) +
        "</div>";
    if (!restricted && !seen?.passed)
      docArea +=
        '<div class="section">' +
        info(
          "If your documents need another check, the order can go to an assisted review.",
          "दस्तावेज़ की अतिरिक्त जाँच के लिए अनुरोध सहायक टीम को भेज सकते हैं।",
        ) +
        B(
          "review",
          tr("Request assisted review", "सहायक समीक्षा माँगें"),
          "ghost",
          S.busy,
        ) +
        "</div>";
  }
  const status = seen
    ? '<div id="result" role="status" class="alert ' +
      (seen.review ? "error" : "") +
      '"><strong>' +
      esc(seen.label) +
      "</strong><br>" +
      esc(seen.details) +
      "</div>"
    : "";
  $("main").innerHTML =
    title(
      tr("Identity & consent", "पहचान और सहमति"),
      tr("Verify your business", "अपना व्यवसाय सत्यापित करें"),
      tr(
        "Check the identity behind your quote. Then send the order for fulfilment.",
        "कोटेशन के व्यवसाय की पहचान जाँचें और आगे की प्रक्रिया के लिए अनुरोध भेजें।",
      ),
    ) +
    '<div class="layout"><div class="card"><h2>' +
    esc(S.form.name) +
    '</h2><div class="caps">' +
    tr("Purpose of verification", "जाँच का उद्देश्य") +
    "</div>" +
    info(
      "Use only synthetic documents to match this business to a mock registry. This demo keeps verification results in memory until you refresh or start over.",
      "केवल काल्पनिक दस्तावेज़ों से व्यवसाय को मॉक रजिस्ट्री से मिलाएँ। डेमो परिणाम पेज रीफ़्रेश या नई शुरुआत तक मेमोरी में रखता है।",
    ) +
    '<label class="choice"><input id="consent" type="checkbox" ' +
    (S.consent ? "checked" : "") +
    " " +
    (S.busy ? "disabled" : "") +
    "><span>" +
    tr(
      "I consent to this verification for this order.",
      "मैं इस ऑर्डर के लिए जाँच की सहमति देता/देती हूँ।",
    ) +
    "</span></label>" +
    docArea +
    (S.busy
      ? '<p role="status" class="info">' +
        tr("Checking locally…", "स्थानीय जाँच जारी है…") +
        "</p>"
      : "") +
    (S.error
      ? '<p role="alert" class="alert error">' + esc(S.error) + "</p>"
      : "") +
    status +
    '<div class="ctas">' +
    B(
      "submit-order",
      seen?.review || pendingDoc
        ? tr("Send review request →", "समीक्षा अनुरोध भेजें →")
        : tr("Place demo order →", "डेमो ऑर्डर भेजें →"),
      "cta",
      !S.consent || !seen || (!seen.passed && !seen.review) || S.busy,
    ) +
    "</div></div>" +
    summary(false) +
    "</div>";
  $("consent").onchange = (e) => {
    S.consent = e.target.checked;
    S.verified = null;
    S.aux = {};
    S.error = "";
    refresh();
  };
  if ($("sample"))
    $("sample").onclick = () => {
      S.verified = {
        passed: true,
        review: false,
        label: tr("Sample GST record matched", "नमूना GST रिकॉर्ड मिला"),
        details:
          "Harmony Dental Care · " +
          tr(
            "Active · GST ending Y1ZL · pre-extracted sample",
            "सक्रिय · GST अंत Y1ZL · पहले पढ़ा गया नमूना",
          ),
      };
      S.error = "";
      refresh();
    };
  if ($("review"))
    $("review").onclick = () => {
      S.verified = {
        passed: false,
        review: true,
        label: tr(
          "Assisted document review selected",
          "सहायक दस्तावेज़ समीक्षा चुनी गई",
        ),
        details: tr(
          "A reviewer still needs to confirm the business identity.",
          "समीक्षक को व्यवसाय की पहचान की पुष्टि करनी है।",
        ),
      };
      S.error = "";
      refresh();
    };
  if ($("lookup")) $("lookup").onclick = () => handleVerify(false);
  if ($("extract")) $("extract").onclick = () => handleVerify(true);
  if ($("support-check"))
    $("support-check").onclick = () => handleVerify(true, true);
  $("submit-order").onclick = () => {
    if (!S.verified || !S.consent) return;
    S.receiptReview = !!S.verified.review || pendingDoc;
    S.ticket = "UD-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    S.step = 3;
    refresh(true);
  };
}
function fileData(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}
async function handleVerify(ocr, aux = false) {
  if (!S.consent) return;
  const kind = $(aux ? "support-kind" : "kind").value,
    id = $("identifier").value.trim(),
    file = $(aux ? "support-document" : "document")?.files?.[0];
  if (!aux) S.verified = null;
  S.error = "";
  if (
    ocr &&
    (!file ||
      file.size > 4 * 1024 * 1024 ||
      !["image/jpeg", "image/png"].includes(file.type))
  ) {
    S.error = tr(
      "Choose a JPG or PNG specimen up to 4 MB.",
      "अधिकतम 4 MB की JPG या PNG नमूना फ़ाइल चुनें।",
    );
    refresh();
    return;
  }
  if (!ocr && !id) {
    S.error = tr(
      "Enter the synthetic registration number.",
      "काल्पनिक पंजीकरण संख्या दर्ज करें।",
    );
    refresh();
    return;
  }
  S.busy = true;
  refresh();
  try {
    const payload = ocr
      ? { consent: true, kind, image: await fileData(file) }
      : { consent: true, kind, identifier: id };
    const r = await api(ocr ? "ocr" : "verify", payload, ocr ? 82000 : 15000);
    if (aux) {
      const mismatch =
        r.businessName && norm(r.businessName) !== norm(S.form.name);
      const label = mismatch
        ? tr(
            "Business name differs. A reviewer must check this document.",
            "व्यवसाय का नाम अलग है। दस्तावेज़ की समीक्षा चाहिए।",
          )
        : r.passed
          ? tr("Date check passed", "तारीख जाँच सफल")
          : tr("Date check requires review", "तारीख जाँच के लिए समीक्षा चाहिए");
      S.aux[kind] = {
        passed: !!r.passed && !mismatch,
        label: label + (r.documentDate ? " · " + r.documentDate : ""),
      };
      return;
    }
    const pass =
      (ocr ? r.passed : r.found) &&
      (r.status === "Active" || r.status === "Registered") &&
      norm(r.businessName) === norm(S.form.name);
    const restricted = Object.keys(S.items).some(
      (k) => products[k].requires_gstin === "Y",
    );
    if (!pass)
      S.error = tr(
        "We could not match an active record to this business name. Check the document type, name and identifier.",
        "इस व्यवसाय के नाम से सक्रिय रिकॉर्ड नहीं मिला। दस्तावेज़ का प्रकार, नाम और संख्या जाँचें।",
      );
    else if (restricted && kind !== "gst")
      S.error = tr(
        "This bundle includes a GST-restricted service. Verify an active GST registration or change the bundle.",
        "इस बंडल की एक सेवा के लिए GST ज़रूरी है। सक्रिय GST जाँचें या बंडल बदलें।",
      );
    else
      S.verified = {
        passed: true,
        review: false,
        label: ocr
          ? tr(
              "Image read and registry matched",
              "तस्वीर पढ़ी गई और रजिस्ट्री से मिलान हुआ",
            )
          : tr("Mock registry matched", "मॉक रजिस्ट्री से मिलान हुआ"),
        details: [r.businessName, r.status, r.maskedId]
          .filter(Boolean)
          .join(" · "),
      };
  } catch {
    S.error = tr(
      "The local check did not finish. Try again or request a review for eligible services.",
      "स्थानीय जाँच पूरी नहीं हुई। फिर प्रयास करें या पात्र सेवाओं की समीक्षा माँगें।",
    );
  } finally {
    S.busy = false;
    refresh();
  }
}
function trackView() {
  const onHold = S.receiptReview,
    t = totals();
  const events = [
    [
      tr("Quote accepted", "कोटेशन स्वीकार हुआ"),
      tr(
        "Monthly total and one-time charge confirmed.",
        "मासिक कुल और सेटअप शुल्क की पुष्टि हुई।",
      ),
      "ok",
    ],
    [
      onHold
        ? tr("Document review pending", "दस्तावेज़ समीक्षा लंबित")
        : tr("Business record checked", "व्यवसाय का रिकॉर्ड जाँचा गया"),
      onHold
        ? tr("Assigned to the verification desk.", "सत्यापन टीम को सौंपा गया।")
        : S.verified.details,
      onHold ? "current" : "ok",
    ],
    [
      tr("Site feasibility check", "स्थान की व्यवहार्यता जाँच"),
      tr(
        "The installation partner checks availability and confirms a slot.",
        "इंस्टॉलेशन पार्टनर उपलब्धता जाँचकर समय की पुष्टि करेगा।",
      ),
      onHold ? "" : "current",
    ],
    [
      tr("Installation & activation", "इंस्टॉलेशन और सक्रियण"),
      tr("Awaiting site confirmation.", "स्थान की पुष्टि की प्रतीक्षा है।"),
      "",
    ],
  ];
  $("main").innerHTML =
    title(
      tr("Order tracker", "ऑर्डर की स्थिति"),
      onHold
        ? tr("Review request received", "समीक्षा अनुरोध मिला")
        : tr("Your order is in", "आपका ऑर्डर मिला"),
      esc(S.form.name) +
        " · " +
        esc(S.ticket) +
        " · " +
        tr("Simulated order", "डेमो ऑर्डर"),
    ) +
    '<div class="layout"><section class="card"><h2>' +
    tr("What happens next", "आगे क्या होगा") +
    "</h2>" +
    events
      .map(
        ([label, desc, style]) =>
          '<div class="statusline ' +
          style +
          '"><i aria-hidden="true">' +
          (style === "ok" ? "✓" : "") +
          "</i><div><h3>" +
          label +
          '</h3><p class="info">' +
          esc(desc) +
          "</p></div></div>",
      )
      .join("") +
    '<div class="hint">' +
    tr(
      "Typical installation is up to " +
        t.days +
        " days for the longest item after site confirmation. A partner still needs to confirm your actual date.",
      "स्थान की पुष्टि के बाद सबसे अधिक समय लेने वाली सेवा की सामान्य अवधि " +
        t.days +
        " दिन है। वास्तविक तारीख पार्टनर तय करेगा।",
    ) +
    '</div><div class="ctas">' +
    B(
      "restart",
      tr("Start another purchase", "दूसरी खरीद शुरू करें"),
      "ghost",
    ) +
    "</div></section>" +
    summary(false) +
    "</div>";
  $("restart").onclick = () => {
    reset(S.seed);
    refresh(true);
  };
}
["en", "hi"].forEach(
  (l) =>
    ($(l).onclick = () => {
      if (S.lang === l || S.busy) return;
      if (S.step === 0) readForm();
      S.lang = l;
      const p = profiles[S.seed];
      if ([p.needs, p.hi].includes(S.form.needs))
        S.form.needs = l === "hi" ? p.hi : p.needs;
      if (S.step === 1) {
        S.explanation = "";
        S.model = false;
        S.alternatives = null;
      }
      refresh();
    }),
);
reset(location.hash === "#salon" ? "salon" : "clinic");
refresh();
window.addEventListener("hashchange", () => {
  if (!S.busy && ["#salon", "#clinic"].includes(location.hash)) {
    reset(location.hash.slice(1));
    refresh(true);
  }
});
if (location.protocol === "http:" || location.protocol === "https:")
  api("health", undefined, 2000)
    .then((r) => {
      if (r.ok) {
        S.health = r;
        if (!S.busy && S.step !== 0) refresh();
      }
    })
    .catch(() => {});
