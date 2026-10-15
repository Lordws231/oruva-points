/* The Oruva Newsletter — subscribe popup (Ventures Platform "Series V" pattern)
   v2: the form inside is Zoho Campaigns' OFFICIAL embed (their optin.min.js +
   raw form, values captured verbatim from Campaigns, list "Oruva Newsletter",
   double opt-in ON) restyled to Oruva's design. v1's hand-rolled POST was
   silently spam-dropped by Zoho (verified 2026-10-15: endpoint returned a
   "success" page but 0 visits/conversions and no contact) — only the
   official JS flow registers subscribers.
   Consent: this form is the opt-in. Details are used ONLY for The Oruva
   Newsletter (Esther's instruction). Unsubscribe is in every edition. */
(function () {
  'use strict';

  var COVER_URL = 'https://newsletter.oruva.com.ng/assets/covers/welcome.png';
  var FORM_IX = '3z3d81e8a083704a5d17393cf1f88569af9be08e1822884641ffcc21a5522fc347';
  var DISMISS_DAYS = 7;
  var SHOW_DELAY_MS = 2500;

  var LS_SUB = 'oruva_nl_subscribed';
  var LS_DIS = 'oruva_nl_dismissed_at';
  try {
    if (localStorage.getItem(LS_SUB)) return;
    var d = +localStorage.getItem(LS_DIS) || 0;
    if (d && (Date.now() - d) < DISMISS_DAYS * 864e5) return;
    if (sessionStorage.getItem('oruva_nl_shown')) return;
  } catch (e) {}

  var css = '\
.oruva-nl-overlay{position:fixed;inset:0;background:rgba(8,30,58,.62);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;animation:oruvaNlFade .3s ease}\
@keyframes oruvaNlFade{from{opacity:0}to{opacity:1}}\
.oruva-nl-card{background:#fdf6e3;border-radius:22px;max-width:520px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 30px 80px rgba(0,0,0,.35);position:relative;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#1c2430;animation:oruvaNlUp .35s ease}\
@keyframes oruvaNlUp{from{transform:translateY(18px);opacity:0}to{transform:none;opacity:1}}\
.oruva-nl-card img.cover{width:100%;height:200px;object-fit:cover;display:block}\
.oruva-nl-x{position:absolute;top:12px;right:12px;width:38px;height:38px;border:none;border-radius:50%;background:#fdf6e3;color:#081e3a;font-size:19px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);line-height:1;z-index:2}\
.oruva-nl-body{padding:26px 28px 30px}\
.oruva-nl-body h2{font-family:Fraunces,Georgia,serif;color:#123a63;font-size:clamp(1.35rem,4.5vw,1.7rem);line-height:1.2;margin:0 0 10px}\
.oruva-nl-body p.lede{margin:0 0 18px;color:#3c4757;font-size:.98rem;line-height:1.55}\
.oruva-nl-body p.lede a{color:#123a63;font-weight:700;text-decoration:underline}\
#zcampaignOptinForm{margin:0}\
#zcampaignOptinForm .oruva-nl-row{display:flex;gap:10px;margin-bottom:10px}\
#zcampaignOptinForm input[type="text"],#zcampaignOptinForm input[type="email"]{flex:1;min-width:0;padding:13px 16px;border:1px solid #d8d2c0!important;border-radius:999px;font:inherit;background:#fff!important;color:#1c2430;width:100%}\
#zcampaignOptinForm input:focus{outline:2px solid #c9a45c;border-color:#c9a45c}\
#zcampaignOptinForm #zcWebOptin{flex:0 0 auto;padding:13px 26px;border:none;border-radius:999px;background:#081e3a!important;color:#fff!important;font:inherit;font-weight:700;cursor:pointer;white-space:nowrap;height:auto}\
#zcampaignOptinForm #zcWebOptin:hover{background:#0b2a4a!important}\
.oruva-nl-note{font-size:.78rem;color:#5b6675;margin:12px 0 0;text-align:center}\
@media(max-width:520px){#zcampaignOptinForm .oruva-nl-row{flex-direction:column}#zcampaignOptinForm #zcWebOptin{width:100%}.oruva-nl-card img.cover{height:150px}}';

  /* Zoho calls this hook after its submit flow runs — record the subscription
     locally so the popup never nags a subscriber again. */
  window['runOnFormSubmit_sf' + FORM_IX] = function () {
    try { localStorage.setItem(LS_SUB, JSON.stringify({ at: new Date().toISOString(), via: 'zoho-embed' })); } catch (e) {}
  };

  function build() {
    try { sessionStorage.setItem('oruva_nl_shown', '1'); } catch (e) {}
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var ov = document.createElement('div');
    ov.className = 'oruva-nl-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Subscribe to The Oruva Newsletter');
    ov.innerHTML =
      '<div class="oruva-nl-card">' +
      '<button class="oruva-nl-x" aria-label="Close">×</button>' +
      '<img class="cover" src="' + COVER_URL + '" alt="The Oruva Newsletter">' +
      '<div class="oruva-nl-body">' +
      '<h2>Access the roads, ideas and opportunities shaping the future of transport in Africa.</h2>' +
      '<p class="lede">Read <a href="https://newsletter.oruva.com.ng" target="_blank" rel="noopener">The Oruva Newsletter</a> for transport insight, innovation, grants, scholarships and fresh opportunities.</p>' +
      '<div id="sf' + FORM_IX + '" data-type="signupform">' +
      '<form method="POST" id="zcampaignOptinForm" style="margin:0px;" action="https://zcsub-cmpzourl.maillist-manage.com/weboptin.zc" target="_zcSignup">' +
      '<div class="oruva-nl-row">' +
      '<input type="text" name="FIRSTNAME" maxlength="100" placeholder="First Name" autocomplete="given-name">' +
      '<input type="text" name="LASTNAME" maxlength="50" placeholder="Last Name" autocomplete="family-name">' +
      '</div>' +
      '<div class="oruva-nl-row">' +
      '<input type="email" name="CONTACT_EMAIL" maxlength="100" placeholder="Email address" autocomplete="email">' +
      '<input type="button" name="SIGNUP_SUBMIT_BUTTON" id="zcWebOptin" value="Subscribe now">' +
      '</div>' +
      '<input type="hidden" name="zc_trackCode" value="">' +
      '<input type="hidden" name="viewFrom" value="URL_ACTION">' +
      '<input type="hidden" name="submitType" value="optinCustomView">' +
      '<input type="hidden" name="lD" value="117f218e9dff39082">' +
      '<input type="hidden" name="emailReportId" value="">' +
      '<input type="hidden" name="zx" id="cmpZuid" value="13833d7c9">' +
      '<input type="hidden" name="zcvers" value="3.0">' +
      '<input type="hidden" name="oldListIds" id="allCheckedListIds" value="">' +
      '<input type="hidden" name="mode" value="OptinCreateView">' +
      '<input type="hidden" name="zcld" value="117f218e9dff39082">' +
      '<input type="hidden" name="zctd" value="">' +
      '<input type="hidden" name="zc_formIx" value="' + FORM_IX + '">' +
      '<input type="hidden" id="signupTmplName" value="large_form_1">' +
      '<input type="hidden" id="recapThemeOptin" value="0">' +
      '<input type="hidden" id="orgNameFull" value="Oruva Transportation Services">' +
      '<input type="hidden" id="recapTheme" value="0">' +
      '<input type="hidden" id="isRecapIntegDone" value="false">' +
      '<input type="hidden" id="signupFormMode" value="">' +
      '<input type="hidden" id="signupFormType" value="LargeForm_Vertical">' +
      '<input type="hidden" id="recapModeTheme" value="">' +
      '<input type="hidden" id="fieldBorder" value="rgb(222, 222, 222)">' +
      '<input type="hidden" id="document_domain" value="campaigns.zoho.com">' +
      '<input type="hidden" id="zc_Url" value="zcsub-cmpzourl.maillist-manage.com">' +
      '<input type="hidden" id="new_optin_response_in" value="0">' +
      '<input type="hidden" id="duplicate_optin_response_in" value="0">' +
      '<input type="hidden" id="isCaptchaNeeded" value="false">' +
      '<input type="hidden" id="superAdminCap" value="0">' +
      '</form></div>' +
      '<p class="oruva-nl-note">We use your details only to send The Oruva Newsletter. No spam — unsubscribe anytime.</p>' +
      '</div></div>';
    document.body.appendChild(ov);

    /* Load Zoho's official optin script and initialise this form, exactly as
       their embed code does. */
    var sc = document.createElement('script');
    sc.src = 'https://ma.zoho.com/js/optin.min.js';
    sc.onload = function () {
      if (typeof window.setupSF === 'function') {
        window.setupSF('sf' + FORM_IX, 'ZCFORMVIEW', false, 'light', false, '0');
      }
    };
    document.body.appendChild(sc);

    function close() {
      try { localStorage.setItem(LS_DIS, String(Date.now())); } catch (e) {}
      ov.remove();
    }
    ov.querySelector('.oruva-nl-x').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(build, SHOW_DELAY_MS); });
  else setTimeout(build, SHOW_DELAY_MS);
})();
