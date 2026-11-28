import { DEFAULT_THEME, LEGACY_THEME_KEYS, THEME_STORAGE_KEY } from "@/app/lib/theme-constants";

/**
 * Applies the app-wide theme (app/lib/theme-store.ts, keys in app/lib/theme-constants.ts) before first paint so no page flashes the wrong
 * theme: the saved choice, else a choice saved under an older per-portal key, else dark.
 */
export function AdminThemeScript() {
  const keys = JSON.stringify([THEME_STORAGE_KEY, ...LEGACY_THEME_KEYS]);
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){var d=document.documentElement,t='${DEFAULT_THEME}';try{var k=${keys};for(var i=0;i<k.length;i++){var v=localStorage.getItem(k[i]);if(v==='dark'||v==='light'){t=v;break}}}catch(e){}d.setAttribute('data-theme',t)})();`,
      }}
    />
  );
}
