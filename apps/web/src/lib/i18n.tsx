// English / Vietnamese. Each device keeps its own choice; texts from the server come as {en, vi}.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang, T } from '@arena/types';

const KEY = 'ecom:lang';

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'vi') return saved;
  } catch {
    /* storage blocked */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Pick the text for the current language. */
  t: (x: T | null | undefined) => string;
  /** Inline UI string: tr('Join', 'Vào'). */
  tr: (en: string, vi: string) => string;
}

const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo<LangCtx>(
    () => ({
      lang,
      setLang: (l) => {
        setLangState(l);
        try {
          localStorage.setItem(KEY, l);
        } catch {
          /* ignore */
        }
      },
      t: (x) => (x ? x[lang] : ''),
      tr: (en, vi) => (lang === 'en' ? en : vi),
    }),
    [lang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('LangProvider missing');
  return v;
}

export function LangToggle({ dark }: { dark?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`flex overflow-hidden rounded-lg text-xs font-bold ring-1 ${dark ? 'ring-white/30' : 'ring-ink/20'}`} role="group" aria-label="Language">
      {(['en', 'vi'] as const).map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)} className={`px-2 py-1 ${lang === l ? 'bg-amber text-ink' : dark ? 'text-white/80' : 'text-ink/60'}`} aria-pressed={lang === l}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Errors from the API carry both languages. */
export type Err = T | null;
export function errOf(err: unknown, fallback: T): T {
  if (err && typeof err === 'object' && 'message' in err) {
    const e = err as { message: string; messageVi?: string };
    return { en: e.message, vi: e.messageVi ?? e.message };
  }
  return fallback;
}
