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
        const currUrl: string = res.url;
        const popupForm = document.createElement('form');
        popupForm.classList.add('extension-popup-form');
        popupForm.id = 'extension-popup-form';
        popupForm.ariaLabel = 'extension-popup-form';

        const popupLabel = document.createElement('label');
        popupLabel.classList.add('url-input-label');
        popupLabel.setAttribute('for', 'url');
        popupLabel.textContent = 'Enter URL of the website you want to block';

        const popupInput = document.createElement('input');
        popupInput.classList.add('url-input');
        popupInput.name = 'url';
        popupInput.type = 'text';
        popupInput.placeholder = 'example.com';
        popupInput.value = currUrl;
        popupInput.minLength = minUrlLength;
        popupInput.maxLength = maxUrlLength;
        popupInput.required = true;
        popupInput.autofocus = true;

        popupLabel.appendChild(popupInput);
        popupForm.appendChild(popupLabel);

        const errorPara = document.createElement('p');
        errorPara.classList.add('extension-error-para');
        popupForm.appendChild(errorPara);

        // Custom checkbox
        const domainLabel = document.createElement('label');
        domainLabel.classList.add('extension-block-domain-label');
        domainLabel.setAttribute('for', 'block-domain');
        domainLabel.textContent = 'Block entire domain';
        
        const domainInput = document.createElement('input');
        domainInput.id = 'block-domain';
        domainInput.classList.add('block-domain');
        domainInput.name = 'block-domain';
        domainInput.type = 'checkbox';
        domainInput.value = 'blockDomain';
        domainInput.checked = true;
        domainLabel.appendChild(domainInput);
        const domainSpan = document.createElement('span');
        domainSpan.classList.add('extension-domain-checkmark');
        domainLabel.appendChild(domainSpan);
        popupForm.appendChild(domainLabel);

        const closeBtnContainer = document.createElement('div');
        closeBtnContainer.classList.add('extension-close-btn-container');

        const escText = document.createElement('p');
        escText.textContent = 'Esc';
        closeBtnContainer.appendChild(escText);

        const closeBtn = document.createElement('button');
        closeBtn.id = 'close-form-btn';
        closeBtn.classList.add('extension-close-form-btn');
        closeBtn.title = 'Close button';
        closeBtn.setAttribute('aria-label', 'Close button');
        closeBtn.type = 'button';

        const closeIcon = document.createElement('img');
        closeIcon.src = browser.runtime.getURL('icons/x.svg');
        closeIcon.alt = 'close icon';
        closeBtn.appendChild(closeIcon);
        closeBtnContainer.appendChild(closeBtn);
        popupForm.appendChild(closeBtnContainer);

        const formBtnContainer = document.createElement('div');
        formBtnContainer.classList.add('extension-form-btn-container');

        const submitBtn = document.createElement('button');
        submitBtn.id = 'submit-btn';
        submitBtn.classList.add('extension-submit-btn');
        submitBtn.type = 'submit';
        submitBtn.textContent = 'Submit';
        formBtnContainer.appendChild(submitBtn);

        const optionsBtn = document.createElement('button');
        optionsBtn.id = 'go-to-options';
        optionsBtn.classList.add('extension-options-btn');
        optionsBtn.type = 'button';
        optionsBtn.textContent = 'Go to options';
        formBtnContainer.appendChild(optionsBtn);
        popupForm.appendChild(formBtnContainer);

        body.appendChild(popupForm);
        popupForm.addEventListener('submit', (e) => {
          e.preventDefault();
          handleFormSubmission(popupForm, errorPara, handleSuccessfulSubmission);
        });
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            if (popupForm) {
              body.removeChild(popupForm);
            }
          }
        });

        if (closeBtn) {
          const popupForm = document.getElementById('extension-popup-form');
          closeBtn.addEventListener('click', () => {
            if (popupForm) {
              body.removeChild(popupForm);
            }
          });
        }

        if (optionsBtn) {
          optionsBtn.addEventListener('click', () => {
            window.open(browser.runtime.getURL('options.html'));
          })
        }
      } else {
        // console.log('no response', res);
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
}

function hidePopup() {
  const popup = document.getElementById('extension-popup-form');
  popup && document.body.removeChild(popup);
}
