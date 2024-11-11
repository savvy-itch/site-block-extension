import browser from 'webextension-polyfill';
import { forbiddenUrls, maxUrlLength, minUrlLength } from "./globals";
import { deleteRules } from "./helpers";
import { AddAction, GetCurrentUrl, ResToSend } from "./types";

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
              <button id="close-form-btn" class="extension-close-form-btn" type="button">
                <img src="${browser.runtime.getURL('icons/x.svg')}" />
              </button>
            </div>
      
            <div class="extension-form-btn-container">
              <button id="submit-btn" class="extension-submit-btn" type="submit">Submit</button>
              <!-- <button id="clear-btn" type="button">Clear All Rules</button> -->
              <button id="go-to-options" class="extension-options-btn" type="button">Go to options</button>
            </div>
          `;
        popupForm.innerHTML = content;
        body.appendChild(popupForm);
        popupForm.addEventListener('submit', (e) => {
          e.preventDefault();
          handleFormSubmission();
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

        // const clearBtn = document.getElementById('clear-btn');
        // if (clearBtn) {
        //   clearBtn.addEventListener('click', deleteRules);
        // }

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

async function handleFormSubmission() {
  const form = document.getElementById('extension-popup-form') as HTMLFormElement;
  if (form) {
    const formData = new FormData(form);
    const urlToBlock = formData.get('url') as string;
    const blockDomain = (document.getElementById('block-domain') as HTMLInputElement).checked;
    const errorPara = document.getElementById('extension-error-para') as HTMLParagraphElement;
    console.log({ urlToBlock });

    // handle errors
    if (!urlToBlock || forbiddenUrls.some(url => url.test(urlToBlock))) {
      if (errorPara) {
        errorPara.textContent = 'Invalid URL';
      }
      console.error(`Invalid URL: ${urlToBlock}`);
      return;
    } else if (urlToBlock.length < minUrlLength) {
      if (errorPara) {
        errorPara.textContent = 'URL is too short';
      }
      console.error(`URL is too short`);
      return;
    } else if (urlToBlock.length > maxUrlLength) {
      if (errorPara) {
        errorPara.textContent = 'URL is too long';
      }
      console.error(`URL is too long`);
      return;
    }

    const msg: AddAction = { action: "blockUrl", url: urlToBlock, blockDomain };

    try {
      const res: ResToSend = await browser.runtime.sendMessage(msg);
      console.log(res);
      if (res.success) {
        if (res.status === 'added') {
          hidePopup();
          setTimeout(() => {
            window.location.reload();
          }, 100);
          console.log('URL has been saved');
        } else if (res.status === 'duplicate') {
          alert('URL is already blocked');
        }
      }
    } catch (error) {
      console.error(error);
    }
  }
}

function hidePopup() {
  const popup = document.getElementById('extension-popup-form');
  popup && document.body.removeChild(popup);
}
