import { useEffect, useRef, useState } from 'react';
import { configuredAccount } from './account/config';
import { PopupView, type PopupSnapshot } from './popup-view';
import './popup.css';
// Foreground authority recognizes only this popup, never the settings tab.
chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
  if (
    sender.id === chrome.runtime.id &&
    !sender.tab &&
    message &&
    typeof message === 'object' &&
    Object.keys(message).length === 1 &&
    'type' in message &&
    message.type === 'popup-focus-check'
  )
    reply(document.hasFocus());
});
export default function Popup() {
  const [pipeline, setPipeline] = useState<PopupSnapshot>({ state: 'IDLE' });
  const [account, setAccount] = useState('CHECKING');
  const [siteAccess, setSiteAccess] = useState<boolean | null>(null);
  const requestedFill = useRef<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    const read = () =>
      void chrome.runtime
        .sendMessage({ type: 'pipeline-status' })
        .then((value) => {
          if (!active || !value) return;
          if (
            value.state === 'READY' &&
            value.requestId === requestedFill.current
          )
            return;
          setPipeline(value);
        })
        .catch(() => {
          if (active) setPipeline({ state: 'UNAVAILABLE' });
        });
    const accountRead = () =>
      void chrome.runtime
        .sendMessage({ type: 'account-status' })
        .then((value) => {
          if (active) setAccount(value?.state ?? 'SIGN_IN_REQUIRED');
        })
        .catch(() => {
          if (active) setAccount('SIGN_IN_REQUIRED');
        });
    void chrome.permissions
      .contains({ origins: ['https://*/*'] })
      .then((value) => {
        if (active) setSiteAccess(value);
      })
      .catch(() => {
        if (active) setSiteAccess(false);
      });
    read();
    accountRead();
    const timer = setInterval(read, 500);
    const accountTimer = setInterval(accountRead, 15000);
    return () => {
      active = false;
      clearInterval(timer);
      clearInterval(accountTimer);
    };
  }, []);
  const fill = () => {
    const requestId = pipeline.requestId;
    if (
      pipeline.state !== 'READY' ||
      account !== 'SIGNED_IN' ||
      !requestId ||
      requestedFill.current === requestId
    )
      return;
    requestedFill.current = requestId;
    setPipeline({ state: 'FILLING', requestId });
    void chrome.runtime
      .sendMessage({ type: 'pipeline-fill', requestId })
      .then((accepted) => {
        if (accepted !== true)
          setPipeline((current) =>
            current.requestId === requestId ? { state: 'CANCELLED' } : current,
          );
      })
      .catch(() =>
        setPipeline((current) =>
          current.requestId === requestId
            ? { state: 'DELIVERY_UNCONFIRMED' }
            : current,
        ),
      );
  };
  const retry = () => {
    const message =
      pipeline.state === 'EMAIL_CONFIRMATION_REQUIRED'
        ? { type: 'pipeline-confirm-email', requestId: pipeline.requestId }
        : { type: 'pipeline-retry' };
    setPipeline({ state: 'SEARCHING' });
    void chrome.runtime
      .sendMessage(message)
      .then((value) =>
        setPipeline({ state: value ? 'SEARCHING' : 'NO_CHALLENGE' }),
      )
      .catch(() => setPipeline({ state: 'ERROR' }));
  };
  return (
    <PopupView
      pipeline={pipeline}
      account={account}
      siteAccess={siteAccess}
      website={
        (configuredAccount()?.webOrigin ?? 'https://otpguard.net') +
        '/dashboard'
      }
      onFill={fill}
      onRetry={retry}
      onSetup={() => void chrome.runtime.openOptionsPage()}
    />
  );
}
