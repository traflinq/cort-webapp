import { DEFAULT_THEME, LEGACY_THEME_KEYS, THEME_STORAGE_KEY } from "./theme-context";

/**
 * Pre-paint theme script: sets data-theme before first paint so there is no flash.
 * Mirrors readStoredTheme() (including the one-time legacy-key migration).
 */
export function PortalThemeScript() {
  const legacy = JSON.stringify(LEGACY_THEME_KEYS);
  const js =
    `(function(){var d=document.documentElement,k='${THEME_STORAGE_KEY}',f='${DEFAULT_THEME}';` +
    `try{var t=localStorage.getItem(k);if(t!=='dark'&&t!=='light'){t=null;var L=${legacy};` +
    `for(var i=0;i<L.length;i++){var v=localStorage.getItem(L[i]);if(t===null&&(v==='dark'||v==='light'))t=v;localStorage.removeItem(L[i]);}` +
    `if(t)localStorage.setItem(k,t);}d.setAttribute('data-theme',t||f)}catch(e){d.setAttribute('data-theme',f)}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
