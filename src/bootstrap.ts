void import('./main').catch((error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  document.body.innerHTML = `<pre style="padding:24px;color:#9f3131;white-space:pre-wrap;font:13px ui-monospace,monospace">OpenPDF failed to start\n\n${message.replace(/[&<>]/g, (value) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[value]!)}</pre>`;
});
