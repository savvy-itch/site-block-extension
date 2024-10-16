import { CustomReq, ResToSend } from "./types";

function showPopup() {
  const body = document.body;
  const formExists = document.getElementById('popup-form');
  if (!formExists) {
    const popupForm = document.createElement('form');
    popupForm.classList.add('popup-form');
    popupForm.id = 'popup-form';
    const content = `
      <label for="url" class="url-input-label">
        Enter URL of the website you want to block 
        <input 
          classname="url-input"
          name="url"
          type="text"
          placeholder="example.com"
          autofocus
        />
      </label>

      <div>
        <input type="checkbox" id="block-domain" name="block-domain" value="blockDomain" checked />
        <label for="domain">Block entire domain</label>
      </div>
      
      <button id="close-form-btn" type="button">X</button>

      <div>
        <button id="submit-btn" type="submit">Submit</button>
        <button id="clear-btn" type="button">Clear All Rules</button>
        <button id="go-to-options">Go to options</button>
      </div>
    `;
    popupForm.innerHTML = content;
    body.appendChild(popupForm);
    popupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleFormSubmission();
    });

    const closeBtn = document.getElementById('close-form-btn');
    if (closeBtn) {
      const popupForm = document.getElementById('popup-form');
      closeBtn.addEventListener('click', () => {
        if (popupForm) {
          body.removeChild(popupForm);
        }
      })
    }

    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', deleteRules);
    }

    const optionsBtn = document.getElementById('go-to-options');
    if (optionsBtn) {
      optionsBtn.addEventListener('click', () => {
        window.open(chrome.runtime.getURL('options.html'));
      })
    }
  }
}

showPopup();

function handleFormSubmission() {
  const form = document.getElementById('popup-form') as HTMLFormElement;
  if (form) {
    const formData = new FormData(form);
    const urlToBlock = formData.get('url') as string;
    const blockDomain = (document.getElementById('block-domain') as HTMLInputElement).checked;
    console.log({urlToBlock});

    if (!urlToBlock) {
      console.error(`Invalid URL: ${urlToBlock}`);
      return;
    }

    const msg: CustomReq = { action: "blockUrl", url: urlToBlock, blockDomain };
    chrome.runtime.sendMessage(msg, (res: ResToSend) => {
      console.log({res});
      if (res.success) {
        if (res.status === 'added') {
          alert('URL has been saved');
        } else if (res.status === 'duplicate') {
          alert('URL is already blocked');
        }
      } else {
        console.error(res.error);
      }
    })
  }
}

function deleteRules() {
  const msg: CustomReq = { action: 'deleteAll' };
  chrome.runtime.sendMessage(msg, (res: ResToSend) => {
    if (res.success) {
      alert('All rules have been deleted');
    } else {
      alert('An error occured. Check the console.');
      console.error(res.error);
    }
  })
}
