(() => {
  const dialog = document.getElementById('leasingDialog');
  const form = document.getElementById('leasingForm');
  const status = document.getElementById('leasingStatus');
  const button = form.querySelector('[type=submit]');
  let previousFocus;
  let startedAt;
  let requestId;
  const open = () => {
    previousFocus = document.activeElement;
    startedAt = Date.now();
    requestId = crypto.randomUUID();
    status.textContent = '';
    document.body.classList.add('leasing-open');
    window.luluLenis?.stop();
    dialog.showModal();
  };
  document.getElementById('leasingOpen').addEventListener('click', open);
  document.getElementById('leasingClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('leasing-open');
    if (!document.body.classList.contains('menu-open') && !document.body.classList.contains('modal-open')) window.luluLenis?.start();
    previousFocus?.focus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    button.disabled = true;
    status.textContent = 'Sending your enquiry…';
    const values = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({...values, consent: form.consent.checked, startedAt, requestId})
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Please try again.');
      status.textContent = result.message;
      form.reset();
      requestId = crypto.randomUUID();
      startedAt = Date.now();
    } catch (error) {
      status.textContent = error instanceof SyntaxError || error instanceof TypeError ? 'Unable to send right now. Please try again or contact us using WhatsApp.' : error.message;
    } finally { button.disabled = false; }
  });
})();
