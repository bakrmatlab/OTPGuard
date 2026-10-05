/** Only the live, focused action popup can extend browser foreground authority. */
export async function hasFocusedPopup() {
  try {
    const filter = {
      contextTypes: ['POPUP' as chrome.runtime.ContextType],
      documentUrls: [chrome.runtime.getURL('popup.html')],
    };
    const contexts = await chrome.runtime.getContexts(filter);
    if (contexts.length !== 1 || !contexts[0]?.documentId) return false;
    const focus = await chrome.runtime.sendMessage({
      type: 'popup-focus-check',
    });
    const live = await chrome.runtime.getContexts(filter);
    return (
      focus === true &&
      live.length === 1 &&
      live[0]?.documentId === contexts[0].documentId
    );
  } catch {
    return false;
  }
}
export async function isForeground(tabId: number) {
  const [tab, window] = await Promise.all([
    chrome.tabs.get(tabId),
    chrome.windows.getLastFocused(),
  ]);
  if (!tab.active || window.id !== tab.windowId) return false;
  if (window.focused) return true;
  if (!(await hasFocusedPopup())) return false;
  // Attestation yields: recheck the active browser tab and last window afterward.
  const [currentTab, currentWindow] = await Promise.all([
    chrome.tabs.get(tabId),
    chrome.windows.getLastFocused(),
  ]);
  return !!(
    currentTab.active &&
    currentTab.windowId === tab.windowId &&
    currentWindow.id === tab.windowId
  );
}
