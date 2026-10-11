from pathlib import Path
import re
p=Path('index.html')
s=p.read_text()
s=re.sub(r'<script[^>]+kaspersky-labs\.com[^>]*>.*?</script>', '', s, flags=re.S)
modal='''
  <button type="button" class="whatsapp-float leasing-float" id="leasingOpen" aria-haspopup="dialog" aria-controls="leasingDialog" aria-label="Leasing enquiries">
    <span class="whatsapp-float__label">LEASING ENQUIRIES</span>
    <span class="whatsapp-float__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 4h18v16H3V4zm2 2v1l7 5 7-5V6H5zm14 3.5-7 5-7-5V18h14V9.5z"/></svg></span>
  </button>
  <dialog id="leasingDialog" class="leasing-dialog" aria-labelledby="leasingTitle" data-lenis-prevent>
    <button type="button" id="leasingClose" class="leasing-close" aria-label="Close leasing enquiry">×</button>
    <p class="leasing-eyebrow">YOUR NEXT CHAPTER</p>
    <h2 id="leasingTitle">Lease at Lulu Centre</h2>
    <p class="leasing-intro">Tell us about your business. Our leasing team will get in touch.</p>
    <form id="leasingForm">
      <div class="leasing-grid">
        <label>Full name<input name="name" autocomplete="name" required maxlength="120"></label>
        <label>Company / brand<input name="company" autocomplete="organization" required maxlength="160"></label>
        <label>Email address<input name="email" type="email" autocomplete="email" required maxlength="254"></label>
        <label>Phone number<input name="phone" type="tel" autocomplete="tel" required maxlength="40"></label>
      </div>
      <label>Space / business requirements<textarea name="message" rows="4" required maxlength="4000" placeholder="Business type, preferred space and your requirements"></textarea></label>
      <div class="leasing-honey" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
      <label class="leasing-consent"><input type="checkbox" name="consent" required> <span>I agree to be contacted regarding my leasing enquiry.</span></label>
      <button type="submit" class="leasing-submit">SEND ENQUIRY <span aria-hidden="true">↗</span></button>
      <p id="leasingStatus" class="leasing-status" role="status" aria-live="polite"></p>
    </form>
  </dialog>
'''
s=s.replace('  <!-- Lenis Smooth Scroll -->', modal+'\n  <!-- Lenis Smooth Scroll -->')
s=s.replace('<script src="script.js"></script>', '<script src="script.js"></script>\n  <script src="leasing.js"></script>')
p.write_text(s)
