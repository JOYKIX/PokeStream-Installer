"use client";
import { useI18n } from "@/i18n/client";
import { SiteFooter } from "./site-header";

export function PageLoading({
  title,
  variant = "page",
}: {
  title: string;
  variant?: "page" | "studio" | "auth";
}) {
  const { t: tr } = useI18n();
  if (variant === "studio")
    return (
      <div className="studio-shell" aria-busy="true">
        <div className="studio-main">
          <div className="studio-header">
            <span className="loading-status" role="status">
              {tr("Chargement…")}
            </span>
          </div>
          <main className="studio-workspace" id="main">
            <div className="workspace-title">
              <div>
                <h1>{tr(title)}</h1>
                <span
                  className="loading-bar loading-bar-short"
                  aria-hidden="true"
                />
              </div>
            </div>
            <div className="workspace-grid" aria-hidden="true">
              <div className="workspace-content">
                <div className="page-loading-card studio-loading-preview" />
                <div className="page-loading-card studio-loading-team" />
              </div>
              <div className="inspector studio-loading-inspector">
                <span className="loading-bar" />
                <span className="loading-bar loading-bar-short" />
              </div>
            </div>
          </main>
          <div className="studio-footer" aria-hidden="true">
            PokeStream
          </div>
        </div>
      </div>
    );
  if (variant === "auth")
    return (
      <div className="site-shell">
        <main className="auth-page" id="main" aria-busy="true">
          <section className="auth-card auth-loading-card">
            <h1>{tr(title)}</h1>
            <p className="loading-status" role="status">
              {tr("Chargement…")}
            </p>
            <div aria-hidden="true" className="auth-loading-fields">
              <span className="loading-bar" />
              <span className="loading-bar" />
              <span className="loading-bar" />
              <span className="loading-bar loading-bar-short" />
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    );
  return (
    <div className="site-shell">
      <main className="site-container" id="main" aria-busy="true">
        <div className="page-heading">
          <h1>{tr(title)}</h1>
        </div>
        <p className="loading-status" role="status">
          {tr("Chargement…")}
        </p>
        <div className="page-loading-grid" aria-hidden="true">
          {[0, 1, 2].map((item) => (
            <div className="page-loading-card" key={item}>
              <span className="loading-bar" />
              <span className="loading-bar loading-bar-short" />
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
