import type { PublicBrand } from "@prooflyt/contracts";

/**
 *  Renders a tenant's logo monogram + name + (optional) public-domain
 *  hint at the top of a public-facing surface (notice / rights / DSR).
 *  Server component — no client JS, no client-side palette flicker.
 *
 *  The monogram is a coloured circle with up to 4 letters in white,
 *  rendered in the tenant's primaryColor. Tenants who upload a real
 *  logo image can replace this in a later iteration; for now the
 *  monogram is fast, deterministic, and good-enough for >90% of small
 *  Indian tenants who don't have a brand-mark file ready.
 */
export function TenantBrandHeader({
  brand,
  tenantName,
  subtitle,
}: {
  brand: PublicBrand;
  tenantName: string;
  subtitle?: string;
}) {
  return (
    <header className="public-brand-header">
      <div
        className="public-brand-mark"
        style={{ backgroundColor: brand.primaryColor }}
        aria-hidden="true"
      >
        {brand.logoText}
      </div>
      <div className="public-brand-meta">
        <span className="public-brand-name">{tenantName}</span>
        {subtitle && <span className="public-brand-sub">{subtitle}</span>}
        {brand.publicDomain && (
          <span className="public-brand-domain">{brand.publicDomain}</span>
        )}
      </div>
    </header>
  );
}
