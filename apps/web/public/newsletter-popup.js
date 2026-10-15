/* The Oruva Newsletter — subscribe popup (Ventures Platform "Series V" pattern)
   One self-contained file: injects its own styles + markup. Used on
   oruva.com.ng (appended via the shared app.js) and points.oruva.com.ng
   (served from apps/web/public). Modelled on the Ventures Platform site popup:
   cover image, headline, First Name / Last Name / Email, "Subscribe now".
   Consent: this form is the opt-in. Details are used ONLY for The Oruva
   Newsletter (Esther's instruction). Unsubscribe is in every edition.
   Endpoint: Zoho Campaigns signup form (filled in ORUVA_NL_FORM below). */
(function () {
  'use strict';

  /* ---- Zoho Campaigns signup form (list "Oruva Newsletter", captured verbatim
     from the form's Raw HTML embed code, 2026-10-15; double opt-in is ON) ---- */
  var ORUVA_NL_FORM = {
    action: 'https://zcsub-cmpzourl.maillist-manage.com/weboptin.zc',
    hidden: {
      zc_trackCode: '', viewFrom: 'URL_ACTION', submitType: 'optinCustomView',
      lD: '117f218e9dff39082', emailReportId: '', zx: '13833d7c9', zcvers: '3.0',
      oldListIds: '', mode: 'OptinCreateView', zcld: '117f218e9dff39082', zctd: '',
      zc_formIx: '3z3d81e8a083704a5d17393cf1f88569af9be08e1822884641ffcc21a5522fc347'
    },
    fields: { email: 'CONTACT_EMAIL', firstName: 'FIRSTNAME', lastName: 'LASTNAME' }
  };
  var COVER_URL = 'https://newsletter.oruva.com.ng/assets/covers/welcome.png';
  var DISMISS_DAYS = 7;    // after closing, don't nag again for 7 days
  var SHOW_DELAY_MS = 2500;

  var LS_SUB = 'oruva_nl_subscribed';
  var LS_DIS = 'oruva_nl_dismissed_at';
  try {
    if (localStorage.getItem(LS_SUB)) return;                       // already subscribed
    var d = +localStorage.getItem(LS_DIS) || 0;
    if (d && (Date.now() - d) < DISMISS_DAYS * 864e5) return;        // dismissed recently
    if (sessionStorage.getItem('oruva_nl_shown')) return;           // once per session
  } catch (e) {}

  var css = '\
.oruva-nl-overlay{position:fixed;inset:0;background:rgba(8,30,58,.62);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;animation:oruvaNlFade .3s ease}\
@keyframes oruvaNlFade{from{opacity:0}to{opacity:1}}\
.oruva-nl-card{background:#fdf6e3;border-radius:22px;max-width:520px;width:100%;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35);position:relative;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#1c2430;animation:oruvaNlUp .35s ease}\
@keyframes oruvaNlUp{from{transform:translateY(18px);opacity:0}to{transform:none;opacity:1}}\
.oruva-nl-card img.cover{width:100%;height:200px;object-fit:cover;display:block}\
.oruva-nl-x{position:absolute;top:12px;right:12px;width:38px;height:38px;border:none;border-radius:50%;background:#fdf6e3;color:#081e3a;font-size:19px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);line-height:1}\
.oruva-nl-body{padding:26px 28px 30px}\
.oruva-nl-body h2{font-family:Fraunces,Georgia,serif;color:#123a63;font-size:clamp(1.35rem,4.5vw,1.7rem);line-height:1.2;margin:0 0 10px}\
.oruva-nl-body p{margin:0 0 18px;color:#3c4757;font-size:.98rem;line-height:1.55}\
.oruva-nl-body p a{color:#123a63;font-weight:700;text-decoration:underline}\
.oruva-nl-row{display:flex;gap:10px;margin-bottom:10px}\
.oruva-nl-row input{flex:1;min-width:0;padding:13px 16px;border:1px solid #d8d2c0;border-radius:999px;font:inherit;background:#fff;color:#1c2430}\
.oruva-nl-row input:focus{outline:2px solid #c9a45c;border-color:#c9a45c}\
.oruva-nl-sub{flex:0 0 auto;padding:13px 26px;border:none;border-radius:999px;background:#081e3a;color:#fff;font:inherit;font-weight:700;cursor:pointer;white-space:nowrap}\
.oruva-nl-sub:hover{background:#0b2a4a}\
.oruva-nl-note{font-size:.78rem;color:#5b6675;margin:12px 0 0;text-align:center}\
.oruva-nl-done{text-align:center;padding:8px 0 4px}\
.oruva-nl-done .tick{font-size:2rem}\
@media(max-width:520px){.oruva-nl-row{flex-direction:column}.oruva-nl-sub{width:100%}.oruva-nl-card img.cover{height:150px}}';

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
      '<p>Read <a href="https://newsletter.oruva.com.ng" target="_blank" rel="noopener">The Oruva Newsletter</a> for transport insight, innovation, grants, scholarships and fresh opportunities.</p>' +
      '<form class="oruva-nl-form" novalidate>' +
      '<div class="oruva-nl-row"><input name="firstName" type="text" placeholder="First Name" autocomplete="given-name" required><input name="lastName" type="text" placeholder="Last Name" autocomplete="family-name" required></div>' +
      '<div class="oruva-nl-row"><input name="email" type="email" placeholder="Email address" autocomplete="email" required><button class="oruva-nl-sub" type="submit">Subscribe now</button></div>' +
      '<p class="oruva-nl-note">We use your details only to send The Oruva Newsletter. No spam — unsubscribe anytime.</p>' +
      '</form></div></div>';
    document.body.appendChild(ov);

    function close() {
      try { localStorage.setItem(LS_DIS, String(Date.now())); } catch (e) {}
      ov.remove();
    }
    ov.querySelector('.oruva-nl-x').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function esc2(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc2); }
    });

    ov.querySelector('.oruva-nl-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      var first = f.querySelector('[name="firstName"]').value.trim(),
          last = f.querySelector('[name="lastName"]').value.trim(),
          email = f.querySelector('[name="email"]').value.trim();
      if (!first || !last || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        f.reportValidity && f.reportValidity();
        return;
      }
      var sub = f.querySelector('.oruva-nl-sub');
      sub.disabled = true; sub.textContent = 'Subscribing…';
      var done = function () {
        try { localStorage.setItem(LS_SUB, JSON.stringify({ first: first, last: last, email: email, at: new Date().toISOString() })); } catch (err) {}
        ov.querySelector('.oruva-nl-body').innerHTML =
          '<div class="oruva-nl-done"><div class="tick">✅</div><h2>You\u2019re in, ' + first.replace(/</g, '&lt;') + '!</h2>' +
          '<p>Your welcome email is on its way from <strong>newsletter@oruva.com.ng</strong> — add us to your contacts so editions land in your inbox, and read along at <a href="https://newsletter.oruva.com.ng">newsletter.oruva.com.ng</a>.</p>' +
          '<button class="oruva-nl-sub" onclick="this.closest(\'.oruva-nl-overlay\').remove()">Start reading</button></div>';
      };
      if (ORUVA_NL_FORM.action) {
        /* Submit exactly the way Zoho's own embed does: a real form POST into a
           hidden iframe, so the page never navigates away. */
        var ifr = document.createElement('iframe');
        ifr.name = '_zcSignup'; ifr.style.display = 'none';
        document.body.appendChild(ifr);
        var hf = document.createElement('form');
        hf.method = 'POST'; hf.action = ORUVA_NL_FORM.action; hf.target = '_zcSignup';
        hf.style.display = 'none';
        var add = function (n, v) {
          var i = document.createElement('input');
          i.type = 'hidden'; i.name = n; i.value = v; hf.appendChild(i);
        };
        add(ORUVA_NL_FORM.fields.email, email);
        add(ORUVA_NL_FORM.fields.firstName, first);
        add(ORUVA_NL_FORM.fields.lastName, last);
        Object.keys(ORUVA_NL_FORM.hidden).forEach(function (k) { add(k, ORUVA_NL_FORM.hidden[k]); });
        document.body.appendChild(hf);
        hf.submit();
        setTimeout(function () { done(); hf.remove(); ifr.remove(); }, 1200);
      } else {
        done(); // endpoint not wired: local record only (flagged in launch notes)
      }
    });
    var firstInput = ov.querySelector('input[name="firstName"]');
    if (firstInput && !/Mobi|Android/i.test(navigator.userAgent)) firstInput.focus({ preventScroll: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(build, SHOW_DELAY_MS); });
  else setTimeout(build, SHOW_DELAY_MS);
})();
