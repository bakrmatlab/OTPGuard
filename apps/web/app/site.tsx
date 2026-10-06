import React from 'react';
export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
export function SiteHeader() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="OTPGuard home">
          <BrandMark />
          OTPGuard
        </a>
        <nav aria-label="Main navigation">
          <a href="/setup">Setup</a>
          <a href="/help">Help</a>
          <a className="nav-action" href="/dashboard">
            Open workspace <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>
    </>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <a className="brand" href="/">
        OTPGuard
      </a>
      <span>Email codes. Processed in your browser.</span>
      <a href="/help">Privacy &amp; help</a>
    </footer>
  );
}
