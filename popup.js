// Popup logic: query active tab, detect game, and send solver commands.

function showTemporaryStatus(text, ms = 2000) {
  const statusEl = document.getElementById('status-message');
  if (!statusEl) return;
  statusEl.style.display = 'block';
  statusEl.innerText = text;
  setTimeout(() => { statusEl.style.display = 'none'; }, ms);
}

function sendCommandToActiveTab(actionName, retry = true) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    const tabId = tabs[0].id;

    chrome.tabs.sendMessage(tabId, { action: actionName }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('sendMessage error:', chrome.runtime.lastError.message);
        if (retry) {
          // try to inject content script then resend once
          chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, () => {
            if (chrome.runtime.lastError) {
              console.error('Injection failed:', chrome.runtime.lastError.message);
              showTemporaryStatus('Failed to inject content script');
              return;
            }
            // resend without further retries
            sendCommandToActiveTab(actionName, false);
          });
        } else {
          showTemporaryStatus('No response from page');
        }
        return;
      }

      console.log('Command sent:', actionName, 'response:', response);
      showTemporaryStatus('Command sent');
    });
  });
}

// Show/hide game groups and status
function updatePopupUI(gameType) {
  const statusEl = document.getElementById('status-message');
  // hide all groups first
  document.querySelectorAll('.game-group').forEach(g => g.style.display = 'none');

  if (gameType && gameType !== 'none') {
    const groupEl = document.getElementById(`group-${gameType}`);
    if (groupEl) {
      groupEl.style.display = 'block';
      statusEl.style.display = 'none';
      return;
    }
  }

  // default: show status
  statusEl.style.display = 'block';
  statusEl.innerText = 'לא נמצא משחק LinkedIn תומך בעמוד זה.';
}

// Attach click handlers once for all buttons to avoid duplicate listeners
function attachAllButtons() {
  document.querySelectorAll('[id^="solve_"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.id;
      sendCommandToActiveTab(id);
    });
  });
}

// Try to detect game in the active tab. If content script isn't present, inject it then retry.
function detectGameInActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    const tabId = tabs[0].id;

    chrome.tabs.sendMessage(tabId, { action: 'detect_game' }, (response) => {
      if (chrome.runtime.lastError) {
        // content script not present — try to inject
        chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] }, () => {
          if (chrome.runtime.lastError) {
            updatePopupUI('none');
            return;
          }
          // retry detection
          chrome.tabs.sendMessage(tabId, { action: 'detect_game' }, (res) => {
            if (res && res.game) updatePopupUI(res.game);
            else updatePopupUI('none');
          });
        });
        return;
      }

      if (response && response.game) updatePopupUI(response.game);
      else updatePopupUI('none');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  attachAllButtons();
  detectGameInActiveTab();
});