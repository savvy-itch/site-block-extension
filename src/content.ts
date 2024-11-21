import browser from 'webextension-polyfill';
import { maxUrlLength, minUrlLength } from "./globals";
import { GetCurrentUrl, ResToSend } from "./types";
import { handleFormSubmission } from './helpers';

async function showPopup() {
  const body = document.body;
  const formExists = document.getElementById('extension-popup-form');
  if (!formExists) {
    const msg: GetCurrentUrl = { action: 'getCurrentUrl' };

    try {
      const res: ResToSend = await browser.runtime.sendMessage(msg);

      if (res.success && res.url) {
        console.log(res);
        const currUrl: string = res.url;
        const popupForm = document.createElement('form');
        popupForm.classList.add('extension-popup-form');
        popupForm.id = 'extension-popup-form';
        const content = `
          <label for="url" class="url-input-label">
            Enter URL of the website you want to block 
            <input 
              class="url-input"
              name="url"
              type="text"
              placeholder="example.com"
              value="${currUrl}"
              minlength="${minUrlLength}"
              maxlength="${maxUrlLength}"
              required
              autofocus
            />
          </label>
          <p id="extension-error-para" class="extension-error-para"></p>
    
          <label for="block-domain" class="extension-block-domain-label">
            Block entire domain
            <input type="checkbox" id="block-domain" class="extension-block-domain-checkbox" name="block-domain" value="blockDomain" checked />
            <span class="extension-domain-checkmark"></span>
          </label>
          
          <div class="extension-close-btn-container">
            <p>Esc</p>
            <button id="close-form-btn" class="extension-close-form-btn" title="Close button" aria-label="Close button" type="button">
              <img src="${browser.runtime.getURL('icons/x.svg')}" alt="close icon" />
            </button>
          </div>
    
          <div class="extension-form-btn-container">
            <button id="submit-btn" class="extension-submit-btn" type="submit">Submit</button>
            <button id="go-to-options" class="extension-options-btn" type="button">Go to options</button>
          </div>
        `;
        popupForm.innerHTML = content;
        body.appendChild(popupForm);
        popupForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const errorPara = document.getElementById('extension-error-para') as HTMLParagraphElement;
          handleFormSubmission(popupForm, errorPara, handleSuccessfulSubmission);
        });
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            const popupForm = document.getElementById('extension-popup-form');
            if (popupForm) {
              body.removeChild(popupForm);
            }
          }
        });

        const closeBtn = document.getElementById('close-form-btn');
        if (closeBtn) {
          const popupForm = document.getElementById('extension-popup-form');
          closeBtn.addEventListener('click', () => {
            if (popupForm) {
              body.removeChild(popupForm);
            }
          });
        }

        const optionsBtn = document.getElementById('go-to-options');
        if (optionsBtn) {
          optionsBtn.addEventListener('click', () => {
            window.open(browser.runtime.getURL('options.html'));
          })
        }
      } else {
        console.log('no response', res);
      }
    } catch (error) {
      console.error(error);
      alert('Something went wrong. Please try again.');
    }
  }
}

showPopup();

function handleSuccessfulSubmission() {
  hidePopup();
  setTimeout(() => {
    window.location.reload();
  }, 100);
  console.log('URL has been saved');
}

function hidePopup() {
  const popup = document.getElementById('extension-popup-form');
  popup && document.body.removeChild(popup);
}
