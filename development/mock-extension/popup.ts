void chrome.runtime
  .sendMessage({ type: 'status' })
  .then((status: unknown) => {
    const output = document.querySelector('output');
    if (
      output &&
      status &&
      typeof status === 'object' &&
      'state' in status &&
      typeof status.state === 'string'
    )
      output.textContent = status.state;
  })
  .catch(() => {});
