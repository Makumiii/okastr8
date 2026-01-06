/**
 * Shared utilities for okastr8 dashboard
 */

// API Key management
let cachedApiKey = localStorage.getItem('okastr8_api_key') || '';

function getApiKey() {
    return cachedApiKey;
}

function setApiKey(key) {
    cachedApiKey = key;
    localStorage.setItem('okastr8_api_key', key);
}

function clearApiKey() {
    cachedApiKey = '';
    localStorage.removeItem('okastr8_api_key');
}

// Result display with icons and animations
function createResultDisplay(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    return {
        showLoading(message = 'Processing...') {
            container.innerHTML = `
        <div class="result-status result-loading">
          <span class="result-icon">⏳</span>
          <span class="result-message">${escapeHtml(message)}</span>
        </div>
      `;
        },

        showSuccess(message) {
            container.innerHTML = `
        <div class="result-status result-success">
          <span class="result-icon">✅</span>
          <span class="result-message">${escapeHtml(message)}</span>
        </div>
      `;
        },

        showError(message) {
            container.innerHTML = `
        <div class="result-status result-error">
          <span class="result-icon">❌</span>
          <span class="result-message">${escapeHtml(message)}</span>
        </div>
      `;
        },

        showWarning(message) {
            container.innerHTML = `
        <div class="result-status result-warning">
          <span class="result-icon">⚠️</span>
          <span class="result-message">${escapeHtml(message)}</span>
        </div>
      `;
        },

        showData(data, title = 'Result') {
            const formatted = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
            container.innerHTML = `
        <div class="result-status result-data">
          <div class="result-title">${escapeHtml(title)}</div>
          <pre class="result-pre">${escapeHtml(formatted)}</pre>
        </div>
      `;
        },

        showUnauthorized() {
            container.innerHTML = `
        <div class="result-status result-warning">
          <span class="result-icon">🔒</span>
          <span class="result-message">Unauthorized. Please enter a valid API key.</span>
          <button onclick="showApiKeyModal()" class="btn btn-small">Set API Key</button>
        </div>
      `;
        },

        clear() {
            container.innerHTML = '';
        }
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// API request helper with auth
async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (cachedApiKey) {
        headers['X-API-Key'] = cachedApiKey;
    }

    const response = await fetch(`/api${endpoint}`, {
        ...options,
        headers
    });

    const data = await response.json();

    if (response.status === 401) {
        throw new Error('UNAUTHORIZED');
    }

    return data;
}

async function apiPost(endpoint, body = {}) {
    return apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    });
}

async function apiGet(endpoint) {
    return apiRequest(endpoint, { method: 'GET' });
}

// Form handler
function handleFormSubmit(form, endpoint, resultDisplay, transform = null) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        resultDisplay.showLoading();

        try {
            const formData = new FormData(form);
            let data = Object.fromEntries(formData.entries());

            if (transform) {
                data = transform(data);
            }

            const result = await apiPost(endpoint, data);

            if (result.success) {
                resultDisplay.showSuccess(result.message || 'Operation successful');
                if (result.data) {
                    setTimeout(() => resultDisplay.showData(result.data), 1500);
                }
            } else {
                resultDisplay.showError(result.message || 'Operation failed');
            }
        } catch (error) {
            if (error.message === 'UNAUTHORIZED') {
                resultDisplay.showUnauthorized();
            } else {
                resultDisplay.showError(error.message || 'Network error');
            }
        }
    });
}

// Button handler
function handleButtonClick(button, endpoint, resultDisplay, isPost = false) {
    button.addEventListener('click', async () => {
        resultDisplay.showLoading();

        try {
            const result = isPost ? await apiPost(endpoint) : await apiGet(endpoint);

            if (result.success) {
                if (result.data) {
                    resultDisplay.showData(result.data, result.message);
                } else {
                    resultDisplay.showSuccess(result.message || 'Success');
                }
            } else {
                resultDisplay.showError(result.message || 'Failed');
            }
        } catch (error) {
            if (error.message === 'UNAUTHORIZED') {
                resultDisplay.showUnauthorized();
            } else {
                resultDisplay.showError(error.message || 'Network error');
            }
        }
    });
}

// API Key Modal
function showApiKeyModal() {
    const existingModal = document.getElementById('api-key-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'api-key-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
    <div class="modal-content">
      <h3>🔑 API Key</h3>
      <input type="password" id="api-key-input" placeholder="Enter your API key" value="${escapeHtml(cachedApiKey)}">
      <div class="modal-buttons">
        <button onclick="saveApiKey()" class="btn btn-primary">Save</button>
        <button onclick="generateNewApiKey()" class="btn btn-secondary">Generate New</button>
        <button onclick="closeApiKeyModal()" class="btn btn-cancel">Cancel</button>
      </div>
      <div id="api-key-modal-result"></div>
    </div>
  `;
    document.body.appendChild(modal);
    document.getElementById('api-key-input').focus();
}

function closeApiKeyModal() {
    const modal = document.getElementById('api-key-modal');
    if (modal) modal.remove();
}

function saveApiKey() {
    const input = document.getElementById('api-key-input');
    setApiKey(input.value);
    closeApiKeyModal();
    location.reload();
}

async function generateNewApiKey() {
    const resultEl = document.getElementById('api-key-modal-result');
    resultEl.innerHTML = '<span class="result-loading">⏳ Generating...</span>';

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (cachedApiKey) {
            headers['X-API-Key'] = cachedApiKey;
        }

        const response = await fetch('/auth/generate-key', {
            method: 'POST',
            headers
        });
        const data = await response.json();

        if (data.success) {
            document.getElementById('api-key-input').value = data.apiKey;
            setApiKey(data.apiKey);
            resultEl.innerHTML = '<span class="result-success">✅ Key generated! Copy it and save securely.</span>';
        } else {
            resultEl.innerHTML = `<span class="result-error">❌ ${data.message}</span>`;
        }
    } catch (error) {
        resultEl.innerHTML = `<span class="result-error">❌ ${error.message}</span>`;
    }
}

// Auth status check
async function checkAuthStatus() {
    try {
        const response = await fetch('/auth/status');
        const data = await response.json();

        const authIndicator = document.getElementById('auth-status');
        if (authIndicator) {
            if (data.authEnabled) {
                if (cachedApiKey) {
                    authIndicator.innerHTML = '🔐 Authenticated';
                    authIndicator.className = 'auth-status auth-ok';
                } else {
                    authIndicator.innerHTML = '🔒 API Key Required';
                    authIndicator.className = 'auth-status auth-required';
                }
            } else {
                authIndicator.innerHTML = '⚠️ Open Access';
                authIndicator.className = 'auth-status auth-open';
            }
            authIndicator.onclick = showApiKeyModal;
        }
    } catch (error) {
        console.error('Failed to check auth status:', error);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
});
