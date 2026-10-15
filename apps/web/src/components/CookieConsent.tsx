import { useEffect, useState } from "react";

/**
 * Oruva cookie consent — Tesla-style frosted card (Esther's spec, 2026-10-15).
 *
 * ORDERING RULE: this consent is ALWAYS the first popup on the site.
 * `window.oruvaCookieGate` stays pending until the visitor answers (or
 * resolves immediately when a saved choice exists); any other automatic
 * popup must await it before showing. The choice persists in localStorage
 * under a per-origin key, so the card never reappears once answered.
 * Any element with [data-cookie-settings] reopens the preferences view.
 */

const KEY = "oruva.cookieConsent.v1";

export interface CookieConsentPrefs {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  savedAt: string;
}

declare global {
  interface Window {
    oruvaCookieGate?: Promise<CookieConsentPrefs | null>;
    oruvaCookieConsent?: CookieConsentPrefs;
    __oruvaCookieResolve?: ((value: CookieConsentPrefs | null) => void) | null;
  }
}

function ensureGate(): Promise<CookieConsentPrefs | null> {
  if (!window.oruvaCookieGate) {
    window.oruvaCookieGate = new Promise((res) => {
      window.__oruvaCookieResolve = res;
    });
  }
  return window.oruvaCookieGate;
}

function fireGate(value: CookieConsentPrefs | null) {
  const resolver = window.__oruvaCookieResolve;
  if (resolver) {
    window.__oruvaCookieResolve = null;
    resolver(value);
  }
}

function readSaved(): CookieConsentPrefs | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CookieConsentPrefs) : null;
  } catch {
    return null;
  }
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    position: "fixed",
    left: 14,
    right: 14,
    bottom: 14,
    zIndex: 900,
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(16px) saturate(1.5)",
    WebkitBackdropFilter: "blur(16px) saturate(1.5)",
    border: "1px solid rgba(255,255,255,0.65)",
    borderRadius: 20,
    boxShadow: "0 24px 60px rgba(8,30,58,0.28)",
    padding: "22px 22px 20px",
    color: "#1c2430",
    fontFamily: "Inter, system-ui, sans-serif",
    transition: "opacity .45s ease, transform .45s ease",
  },
  bannerDesktop: {},
  title: {
    fontSize: "1.28rem",
    lineHeight: 1.25,
    fontWeight: 700,
    color: "#081e3a",
    margin: "0 0 10px",
  },
  text: { fontSize: ".94rem", lineHeight: 1.55, color: "#2c3644", margin: "0 0 18px" },
  link: { color: "#081e3a", fontWeight: 600, textDecoration: "underline", cursor: "pointer" },
  actions: { display: "flex", gap: 12 },
  btn: {
    flex: 1,
    fontWeight: 600,
    fontSize: ".98rem",
    padding: "12px 10px",
    borderRadius: 10,
    border: "1px solid transparent",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnPrimary: { background: "#081e3a", color: "#fff" },
  btnLight: { background: "rgba(255,255,255,0.75)", color: "#1c2430", borderColor: "#cfd4da" },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    padding: "11px 0",
    borderTop: "1px solid rgba(8,30,58,0.1)",
  },
  rowStrong: { fontSize: ".95rem", color: "#081e3a" },
  rowText: { fontSize: ".83rem", color: "#5b6675", margin: "3px 0 0", lineHeight: 1.45 },
  locked: { fontSize: ".8rem", fontWeight: 700, color: "#a9853d", whiteSpace: "nowrap" },
};

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative",
        flex: "none",
        width: 48,
        height: 27,
        borderRadius: 999,
        border: "none",
        background: checked ? "#081e3a" : "#c7cdd4",
        cursor: "pointer",
        transition: "background .25s",
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: checked ? 24 : 3,
          top: 3,
          width: 21,
          height: 21,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
          transition: "left .25s",
        }}
      />
    </button>
  );
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [shown, setShown] = useState(false);
  const [view, setView] = useState<"main" | "settings">("main");
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    ensureGate();
    const saved = readSaved();
    if (saved) {
      window.oruvaCookieConsent = saved;
      fireGate(saved);
    } else {
      const timer = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 760);
    onResize();
    window.addEventListener("resize", onResize);
    const reopen = () => {
      const saved = readSaved();
      setAnalytics(saved ? !!saved.analytics : true);
      setMarketing(saved ? !!saved.marketing : true);
      setView("settings");
      setVisible(true);
    };
    const nodes = document.querySelectorAll("[data-cookie-settings]");
    nodes.forEach((node) => node.addEventListener("click", reopen));
    return () => {
      window.removeEventListener("resize", onResize);
      nodes.forEach((node) => node.removeEventListener("click", reopen));
    };
  }, []);

  useEffect(() => {
    if (visible) {
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
  }, [visible]);

  if (!visible) return null;

  const save = (prefs: { analytics: boolean; marketing: boolean }) => {
    const full: CookieConsentPrefs = {
      necessary: true,
      analytics: prefs.analytics,
      marketing: prefs.marketing,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(full));
    } catch {
      /* storage unavailable: the choice still applies to this session */
    }
    window.oruvaCookieConsent = full;
    ensureGate();
    fireGate(full);
    setVisible(false);
  };

  const bannerStyle: React.CSSProperties = {
    ...styles.banner,
    ...(wide ? { left: 26, right: "auto", bottom: 26, width: 408 } : {}),
    opacity: shown ? 1 : 0,
    transform: shown ? "translateY(0)" : "translateY(26px)",
  };

  return (
    <div style={bannerStyle} role="dialog" aria-label="Cookie consent">
      {view === "main" ? (
        <div>
          <h2 style={styles.title}>Help Us Improve Our Website with Cookies</h2>
          <p style={styles.text}>
            We use cookies and process data from your device to analyze website performance,
            personalize content, and improve your experience. Your consent includes data
            transfers outside of the country you&rsquo;re located. View{" "}
            <a
              style={styles.link}
              onClick={(event) => {
                event.preventDefault();
                setView("settings");
              }}
            >
              Cookie Settings
            </a>{" "}
            for more information.
          </p>
          <div style={styles.actions}>
            <button
              type="button"
              style={{ ...styles.btn, ...styles.btnPrimary }}
              onClick={() => save({ analytics: true, marketing: true })}
            >
              Accept
            </button>
            <button
              type="button"
              style={{ ...styles.btn, ...styles.btnLight }}
              onClick={() => save({ analytics: false, marketing: false })}
            >
              Reject
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h2 style={styles.title}>Cookie Settings</h2>
          <div style={styles.row}>
            <div>
              <strong style={styles.rowStrong}>Strictly Necessary</strong>
              <p style={styles.rowText}>
                Required for the website to work — security and your saved choices. Always
                active.
              </p>
            </div>
            <span style={styles.locked}>Always on</span>
          </div>
          <div style={styles.row}>
            <div>
              <strong style={styles.rowStrong}>Analytics &amp; Performance</strong>
              <p style={styles.rowText}>
                Helps us understand which pages people visit so we can improve them.
              </p>
            </div>
            <Toggle checked={analytics} onChange={setAnalytics} label="Analytics and performance cookies" />
          </div>
          <div style={styles.row}>
            <div>
              <strong style={styles.rowStrong}>Personalization &amp; Marketing</strong>
              <p style={styles.rowText}>
                Lets us tailor content and measure how our campaigns perform.
              </p>
            </div>
            <Toggle checked={marketing} onChange={setMarketing} label="Personalization and marketing cookies" />
          </div>
          <div style={{ ...styles.actions, marginTop: 14 }}>
            <button
              type="button"
              style={{ ...styles.btn, ...styles.btnPrimary }}
              onClick={() => save({ analytics, marketing })}
            >
              Save My Settings
            </button>
            <button
              type="button"
              style={{ ...styles.btn, ...styles.btnLight }}
              onClick={() => save({ analytics: true, marketing: true })}
            >
              Accept All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
