'use client';
import React, { useState } from 'react';
import { BrandMark } from './site';
/** Public synthetic illustration only; never connects to the extension or mail. */
export function FillDemo() {
  const [filled, setFilled] = useState(false);
  return (
    <div className="demo-stage">
      <div className="sample-page">
        <div className="sample-chrome">
          <span className="window-dots" aria-hidden="true">
            ● ● ●
          </span>
          <span>example.test</span>
          <span aria-hidden="true">⌁</span>
        </div>
        <div className="sample-form">
          <div className="sample-logo" aria-hidden="true">
            e
          </div>
          <h3>Check your email</h3>
          <p>Enter your verification code.</p>
          <label htmlFor="demo-code">Verification code</label>
          <input
            id="demo-code"
            autoComplete="off"
            placeholder="— — — — — —"
            readOnly
            value={filled ? '047291' : ''}
            className={filled ? 'filled' : undefined}
          />
          <p className="demo-result" role="status">
            {filled
              ? 'Example code inserted. Nothing was submitted.'
              : 'Waiting for your click.'}
          </p>
          <button
            className="text-link reset-demo"
            type="button"
            onClick={() => setFilled(false)}
          >
            Reset demo
          </button>
        </div>
      </div>
      <div className="demo-popup popup">
        <div className="popup-brand">
          <BrandMark />
          OTPGuard
        </div>
        <div className="popup-status">
          <span className="status-dot" />
          {filled ? 'Code inserted' : 'Code found'}
        </div>
        {!filled && (
          <button
            className="button primary"
            type="button"
            onClick={() => setFilled(true)}
          >
            Fill <span aria-hidden="true">↗</span>
          </button>
        )}
        <a className="popup-site" href="/dashboard">
          Open OTPGuard <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
}
