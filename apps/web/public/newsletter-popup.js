/* The Oruva Newsletter — subscribe popup (Ventures Platform "Series V" pattern)
   v3 (Esther's spec, 2026-10-15): still Zoho Campaigns' OFFICIAL embed
   (optin.min.js + raw form, values verbatim, list "Oruva Newsletter",
   double opt-in ON) — v1's hand-rolled POST was silently spam-dropped by
   Zoho, so the official JS flow is the only safe submission path.
   What v3 changes is everything AROUND that flow:
   - Zoho's response is captured in a hidden in-page frame named _zcSignup
     (the form's own target), so no separate Zoho window ever opens. In v2
     that window was blocked or lost on phones, which made Subscribe look
     dead and hid every success message.
   - Subscribe gives instant visible feedback ("Subscribing…"), and errors
     show inline under the form.
   - On success, OUR success message shows on the oruva.com.ng homepage:
     in place if the visitor is already there, otherwise the browser goes
     straight to the homepage and the message appears there. It counts
     down 10 seconds and closes itself. The visitor never leaves the site.
   - The popup itself simply overlays the page — homepage slides keep
     flowing behind it — until the visitor registers or closes it.
   Consent: this form is the opt-in. Details are used ONLY for The Oruva
   Newsletter. Unsubscribe is in every edition. */
(function () {
  'use strict';

  var COVER_URL = 'https://newsletter.oruva.com.ng/assets/covers/welcome.png';
  var FORM_IX = '3z3d81e8a083704a5d17393cf1f88569af9be08e1822884641ffcc21a5522fc347';
  var DISMISS_DAYS = 7;
  var SHOW_DELAY_MS = 2500;
  var SUCCESS_SECONDS = 10;

  var LS_SUB = 'oruva_nl_subscribed';
  var LS_DIS = 'oruva_nl_dismissed_at';
  var SS_SHOWN = 'oruva_nl_shown';
  var SS_SUCCESS = 'oruva_nl_success_at';

  var host = location.hostname.replace(/^www\./, '');
  var IS_MAIN = (host === 'oruva.com.ng');
  var IS_HOME = (location.pathname === '/' || location.pathname === '/index.html');

  function getSS(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function setSS(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function delSS(k) { try { sessionStorage.removeItem(k); } catch (e) {} }

  /* Arriving on the homepage right after a signup elsewhere on the site:
     show the success message here, per spec. */
  var justSucceeded = IS_MAIN && IS_HOME && (getSS(SS_SUCCESS) || /[?&]nl=success\b/.test(location.search));
  if (justSucceeded) delSS(SS_SUCCESS);

  if (!justSucceeded) {
    try {
      if (localStorage.getItem(LS_SUB)) return;
      var d = +localStorage.getItem(LS_DIS) || 0;
      if (d && (Date.now() - d) < DISMISS_DAYS * 864e5) return;
      if (getSS(SS_SHOWN)) return;
    } catch (e) {}
  }

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
#zcampaignOptinForm #zcWebOptin[disabled]{opacity:.55;cursor:wait}\
.oruva-nl-note{font-size:.78rem;color:#5b6675;margin:12px 0 0;text-align:center}\
.oruva-nl-status{font-size:.86rem;margin:10px 0 0;text-align:center;min-height:1.1em;color:#123a63;font-weight:600}\
.oruva-nl-status.err{color:#b3261e}\
.oruva-nl-success{text-align:center;padding:8px 0 2px}\
.oruva-nl-tick{width:74px;height:74px;margin:2px auto 16px;border-radius:50%;background:#c9a45c;color:#081e3a;font-size:38px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px rgba(201,164,92,.45)}\
.oruva-nl-success h2{margin-bottom:8px}\
.oruva-nl-success p{color:#3c4757;font-size:.97rem;line-height:1.55;margin:0 0 14px}\
.oruva-nl-count{font-size:.82rem;color:#5b6675;margin:0 0 10px}\
.oruva-nl-bar{height:5px;border-radius:99px;background:#e7dfc8;overflow:hidden;margin:0 0 16px}\
.oruva-nl-bar i{display:block;height:100%;width:100%;background:#c9a45c;border-radius:99px}\
.oruva-nl-done{padding:12px 30px;border:none;border-radius:999px;background:#081e3a;color:#fff;font:inherit;font-weight:700;cursor:pointer}\
.oruva-nl-done:hover{background:#0b2a4a}\
@media(max-width:520px){#zcampaignOptinForm .oruva-nl-row{flex-direction:column}#zcampaignOptinForm #zcWebOptin{width:100%}.oruva-nl-card img.cover{height:150px}}';

  var state = { submitted: false, succeeded: false, zohoReady: false, scriptTried: 0 };

  /* Zoho calls this hook after its submit flow runs — record the subscription
     locally so the popup never nags a subscriber again, and treat the
     submission as dispatched through Zoho's official channel. */
  window['runOnFormSubmit_sf' + FORM_IX] = function () {
    try { localStorage.setItem(LS_SUB, JSON.stringify({ at: new Date().toISOString(), via: 'zoho-embed' })); } catch (e) {}
    state.submitted = true;
    /* If Zoho's response lands in our hidden frame, its load event confirms
       success sooner; this timer is the fallback (e.g. Zoho answered in a
       way that produced no frame navigation). */
    setTimeout(function () { onSuccess(); }, 3500);
  };

  function loadZoho(btn, status) {
    state.scriptTried++;
    var sc = document.createElement('script');
    sc.src = 'https://ma.zoho.com/js/optin.min.js';
    sc.onload = function () {
      if (typeof window.setupSF === 'function') {
        window.setupSF('sf' + FORM_IX, 'ZCFORMVIEW', false, 'light', false, '0');
        state.zohoReady = true;
      } else if (status) {
        status.textContent = 'The signup service did not load properly — please tap Subscribe again.';
        status.className = 'oruva-nl-status err';
      }
    };
    sc.onerror = function () {
      if (status) {
        status.textContent = 'Could not reach the signup service — check your connection and tap Subscribe again.';
        status.className = 'oruva-nl-status err';
      }
      if (btn) { btn.disabled = false; btn.value = 'Subscribe now'; }
    };
    document.body.appendChild(sc);
  }

  function onSuccess() {
    if (state.succeeded) return;
    state.succeeded = true;
    if (IS_MAIN && !IS_HOME) {
      /* Spec: the success message displays on the homepage. Carry the
         visitor straight home (still inside oruva.com.ng) and show it
         there. */
      setSS(SS_SUCCESS, String(Date.now()));
      location.assign('https://oruva.com.ng/?nl=success');
      return;
    }
    showSuccessCard();
  }

  var overlayRef = null;
  function showSuccessCard() {
    if (!overlayRef) { build(true); return; }
    var body = overlayRef.querySelector('.oruva-nl-body');
    if (!body) return;
    body.innerHTML =
      '<div class="oruva-nl-success">' +
      '<div class="oruva-nl-tick">✓</div>' +
      '<h2>Registration successful!</h2>' +
      '<p>Welcome to <strong>The Oruva Newsletter</strong>. We have sent a confirmation email to your inbox — click the link inside it to complete your subscription. If you don\u2019t see it, please check your Spam folder.</p>' +
      '<p class="oruva-nl-count">This message closes in <strong class="oruva-nl-cd">' + SUCCESS_SECONDS + '</strong> seconds</p>' +
      '<div class="oruva-nl-bar"><i></i></div>' +
      '<button class="oruva-nl-done" type="button">Done</button>' +
      '</div>';
    var cd = body.querySelector('.oruva-nl-cd');
    var bar = body.querySelector('.oruva-nl-bar i');
    var left = SUCCESS_SECONDS;
    var started = Date.now();
    if (bar) { bar.style.transition = 'width ' + SUCCESS_SECONDS + 's linear'; requestAnimationFrame(function () { bar.style.width = '0%'; }); }
    var iv = setInterval(function () {
      left = SUCCESS_SECONDS - Math.floor((Date.now() - started) / 1000);
      if (cd) cd.textContent = Math.max(left, 0);
      if (left <= 0) { clearInterval(iv); dismissSuccess(); }
    }, 250);
    var done = body.querySelector('.oruva-nl-done');
    if (done) done.addEventListener('click', function () { clearInterval(iv); dismissSuccess(); });
    var x = overlayRef.querySelector('.oruva-nl-x');
    if (x) x.onclick = function () { clearInterval(iv); dismissSuccess(); };
  }

  function dismissSuccess() {
    if (overlayRef) overlayRef.remove();
    if (IS_MAIN && IS_HOME && /[?&]nl=success\b/.test(location.search)) {
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
    }
  }

  function build(successOnly) {
    if (!successOnly) setSS(SS_SHOWN, '1');
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
      '<p class="oruva-nl-status" aria-live="polite"></p>' +
      '<p class="oruva-nl-note">We use your details only to send The Oruva Newsletter. No spam — unsubscribe anytime.</p>' +
      '</div></div>' +
      /* Zoho's response target: our own hidden frame, so the answer never
         opens a separate window and the visitor never leaves this page. */
      '<iframe name="_zcSignup" title="Newsletter signup response" style="display:none" aria-hidden="true"></iframe>';
    document.body.appendChild(ov);
    overlayRef = ov;

    var status = ov.querySelector('.oruva-nl-status');
    var btn = ov.querySelector('#zcWebOptin');
    var email = ov.querySelector('input[name="CONTACT_EMAIL"]');
    var frame = ov.querySelector('iframe[name="_zcSignup"]');

    if (frame) frame.addEventListener('load', function () {
      if (state.submitted) onSuccess();
    });

    /* Instant feedback on tap — Zoho's own handler (bound by setupSF) does
       the real validation and submission; this listener never blocks it. */
    if (btn) btn.addEventListener('click', function () {
      var v = (email && email.value || '').trim();
      if (!v || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
        status.textContent = 'Please enter a valid email address to subscribe.';
        status.className = 'oruva-nl-status err';
        return;
      }
      if (!state.zohoReady) {
        status.textContent = 'Loading the signup service — one moment…';
        status.className = 'oruva-nl-status';
        loadZoho(btn, status);
        return;
      }
      status.textContent = 'Subscribing…';
      status.className = 'oruva-nl-status';
      btn.disabled = true;
      btn.value = 'Subscribing…';
      setTimeout(function () {
        if (!state.succeeded && btn.disabled) {
          btn.disabled = false;
          btn.value = 'Subscribe now';
          if (!state.submitted) {
            status.textContent = 'That took longer than expected — please tap Subscribe again. If you already got a confirmation email, you are registered.';
            status.className = 'oruva-nl-status err';
          }
        }
      }, 15000);
    });

    if (!successOnly) loadZoho(btn, status);

    function close() {
      try { localStorage.setItem(LS_DIS, String(Date.now())); } catch (e) {}
      ov.remove();
      if (overlayRef === ov) overlayRef = null;
    }
    ov.querySelector('.oruva-nl-x').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });

    if (successOnly) showSuccessCard();
  }

  if (justSucceeded) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { build(true); });
    else build(true);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { build(false); }, SHOW_DELAY_MS); });
  } else {
    setTimeout(function () { build(false); }, SHOW_DELAY_MS);
  }
})();
