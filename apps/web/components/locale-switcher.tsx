import Link from "next/link";
import { LOCALES, type Locale } from "../lib/i18n";

/**
 *  Renders a row of native-script language links. Server component — no
 *  client-side state needed; Next.js refetches the page with the new
 *  ?lang= query string and the page re-resolves its locale.
 *
 *  We render in native script (हिन्दी / தமிழ் / English) rather than ISO
 *  codes so a non-English-reading principal can recognise their language
 *  without having to decode "hi" or "ta".
 */
export function LocaleSwitcher({
  basePath,
  current,
  label,
  searchParams,
}: {
  basePath: string;
  current: Locale;
  label: string;
  // Carry-over of any other ?key=value pairs the page already had
  // (e.g. ?ack=1) so switching language doesn't blow away state.
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const carry: Record<string, string> = {};
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "lang") continue;
      if (typeof v === "string") carry[k] = v;
    }
  }

  return (
    <nav aria-label={label} className="locale-switcher">
      <span className="locale-switcher__label">{label}:</span>
      <ul>
        {LOCALES.map((loc) => {
          const params = new URLSearchParams({ ...carry, lang: loc.code });
          const href = `${basePath}?${params.toString()}`;
          const isActive = loc.code === current;
          return (
            <li key={loc.code}>
              <Link
                href={href}
                lang={loc.code}
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "locale-switcher__link is-active" : "locale-switcher__link"}
              >
                {loc.nativeLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
