import { SiteHeader, SiteFooter } from './site';
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="guide" tabIndex={-1}>
        <div className="page-heading">
          <div>
            <h1>404</h1>
            <p>This page does not exist.</p>
          </div>
        </div>
        <a className="button secondary" href="/">
          Back to home
        </a>
      </main>
      <SiteFooter />
    </>
  );
}
