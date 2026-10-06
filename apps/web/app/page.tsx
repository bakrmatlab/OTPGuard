import React from 'react';
import { SiteHeader, SiteFooter } from './site';
import { FillDemo } from './fill-demo';
import { PopupShowcase } from './popup-showcase';
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <section className="hero">
          <div className="hero-copy">
            <h1>
              Find the code.
              <br />
              Choose <span className="fill-word">Fill.</span>
            </h1>
            <p className="hero-lead">
              OTPGuard finds a recent email code while you sign in. You decide
              when it goes into the page.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="/install">
                Install for Chrome <span aria-hidden="true">↗</span>
              </a>
              <a className="text-link" href="#demo">
                Try the demo <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
          <div className="handoff-art" aria-hidden="true">
            <div className="orbit orbit-one"></div>
            <div className="orbit orbit-two"></div>
            <div className="signal-spine"></div>
            <div className="signal-source">
              <svg viewBox="0 0 32 32">
                <path d="M5 8h22v16H5zM5 8l11 9L27 8" />
              </svg>
            </div>
            <div className="signal-card">
              <div className="signal-top">
                <span className="status-dot"></span>Code found
              </div>
              <div className="signal-code">••••••</div>
              <div className="signal-fill">
                Fill <span>↗</span>
              </div>
              <div className="signal-tail">OTPGuard</div>
            </div>
            <div className="art-caption">
              Inbox <span>→</span> Your click <span>→</span> Code field
            </div>
          </div>
        </section>
        <section id="demo" className="demo-section">
          <div className="section-intro">
            <h2>
              One click.
              <br />
              One code field.
            </h2>
            <p>
              Try the handoff with a made-up code.
              <br />
              No mailbox. No sign-in. No submission.
            </p>
          </div>
          <FillDemo />
        </section>
        <PopupShowcase />
        <section className="privacy-strip">
          <div className="privacy-symbol" aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <path d="M24 5l15 6v13c0 9-15 18-15 18S9 33 9 24V11zM17 23l5 5 10-11" />
            </svg>
          </div>
          <div>
            <h2>Your mail stays in your browser.</h2>
            <p>
              Gmail tokens, messages and codes stay inside the extension.
              OTPGuard servers do not receive them.
            </p>
          </div>
          <a className="text-link" href="/help">
            Read the details <span aria-hidden="true">↗</span>
          </a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
