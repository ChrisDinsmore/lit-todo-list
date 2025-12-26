import { LitElement, html, css } from 'lit';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { sharedStyles } from './app-styles.js';
import './components/link-item.js';
import './components/link-input.js';
import './components/reader-view.js';

export class ReadLaterApp extends LitElement {
  static properties = {
    _links: { state: true },
    _filter: { state: true },
    _synced: { state: true },
    _currentView: { state: true }, // 'list' or 'reader'
    _roomId: { state: true },
    _showSettings: { state: true },
    _installPrompt: { state: true }
  };

  constructor() {
    super();
    this._links = [];
    this._filter = 'all';
    this._synced = false;
    this._currentView = 'list';
    this._activeArticleId = null;
    this._showSettings = false;
    this._installPrompt = null;

    // Load or generate Room ID
    const storedRoomId = localStorage.getItem('read-later-room-id');
    if (storedRoomId) {
      this._roomId = storedRoomId;
    } else {
      this._roomId = this._generateId();
      localStorage.setItem('read-later-room-id', this._roomId);
    }

    // Initialize Yjs
    this.ydoc = new Y.Doc();
    this.persistence = new IndexeddbPersistence('read-later-store', this.ydoc);
    this.yarray = this.ydoc.getArray('links');
    this.yarray.observe(() => {
      this._links = this.yarray.toArray();
      this.requestUpdate();
    });

    this._links = this.yarray.toArray();
    this._connectProvider();

    // PWA Install Prompt Listener
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._installPrompt = e;
      this.requestUpdate();
    });

    // Reconnect on tab focus (mobile background tab freeze fix)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('App visible, checking connection...');
        if (!this.provider || !this.provider.connected) {
          console.log('Forcing reconnect...');
          this._connectProvider();
        }
      }
    });

    // Handle incoming shared links (PWA Share Target)
    this._handleShareTarget();
  }

  async _handleShareTarget() {
    const params = new URLSearchParams(window.location.search);
    const sharedTitle = params.get('title');
    const sharedText = params.get('text');
    const sharedUrl = params.get('url');

    console.log('Checking for shared content:', { sharedTitle, sharedText, sharedUrl });

    // Try to find a URL in any of the fields
    let urlToSave = sharedUrl;

    if (!urlToSave && sharedText) {
      const urlMatch = sharedText.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        urlToSave = urlMatch[0];
      }
    }

    if (!urlToSave && sharedTitle) {
      const urlMatch = sharedTitle.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        urlToSave = urlMatch[0];
      }
    }

    if (urlToSave) {
      console.log('Found shared URL:', urlToSave);
      // Wait a bit for Yjs to initialize
      await new Promise(r => setTimeout(r, 1000));
      this._addLink({ detail: { url: urlToSave } });

      // Clean command line
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  _connectProvider() {
    if (this.provider) {
      this.provider.destroy();
    }

    // Prefix to ensure namespace unique to this app even if user enters a simple string
    const roomName = 'read-later-v1-' + this._roomId;
    console.log('Connecting to room:', roomName);

    // Custom Cloudflare Worker WebSocket Relay
    const customRelayUrl = `wss://websocket-relay.c-dinsmore.workers.dev/?room=${this._roomId}`;

    const signalingServers = [
      customRelayUrl
    ];

    this.provider = new WebrtcProvider(roomName, this.ydoc, {
      signaling: signalingServers,
      password: roomName // Optional: adds a layer of negotiation security
    });

    this.provider.on('status', ({ status }) => {
      console.log('Sync status:', status);
      this._synced = status === 'connected';
      this.requestUpdate();
    });
  }

  async _installPwa() {
    if (!this._installPrompt) return;
    this._installPrompt.prompt();
    const { outcome } = await this._installPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    this._installPrompt = null;
  }

  _updateRoomId(newId) {
    if (!newId || newId.trim() === '') return;
    this._roomId = newId.trim();
    localStorage.setItem('read-later-room-id', this._roomId);
    this._connectProvider();
    this._showSettings = false;
  }

  _copyRoomId() {
    navigator.clipboard.writeText(this._roomId);
    alert('Sync Key copied to clipboard!');
  }

  _generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'id-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  static styles = [
    sharedStyles,
    css`
    :host {
      display: block;
      width: 100%;
    }

    .container {
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-border);
      border-radius: 24px;
      padding: 2.5rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      position: relative;
      min-height: 600px;
    }

    .header-actions {
      position: absolute;
      top: 1.5rem;
      right: 1.5rem;
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .sync-indicator {
      font-size: 0.7rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .settings-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 50%;
      transition: var(--transition-fast);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .settings-btn:hover {
      background: var(--glass-bg);
      color: white;
    }

    .settings-panel {
      position: absolute;
      top: 4rem;
      right: 1.5rem;
      width: 300px;
      background: #1e1e24;
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      padding: 1.5rem;
      z-index: 100;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      animation: fadeIn 0.2s ease-out;
    }

    .settings-panel h3 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
      color: white;
    }

    .settings-input-group {
      margin-bottom: 1rem;
    }

    .settings-input-group label {
      display: block;
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }

    .code-display {
      background: rgba(0,0,0,0.3);
      padding: 0.75rem;
      border-radius: 8px;
      font-family: monospace;
      font-size: 0.9rem;
      color: var(--primary-color);
      word-break: break-all;
      cursor: pointer;
      border: 1px dashed var(--glass-border);
      transition: var(--transition-fast);
    }

    .code-display:hover {
      background: rgba(0,0,0,0.5);
      border-color: var(--primary-color);
    }

    .input-row {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    .text-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--glass-border);
      color: white;
      padding: 0.5rem;
      border-radius: 6px;
      font-family: inherit;
    }

    .save-btn {
      background: var(--primary-color);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
    }

    .sync-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
    }


    h1 {
      margin: 0 0 2rem 0;
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(to right, #ffffff, var(--primary-color));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
    }

    .version-badge {
      font-size: 1rem;
      background: rgba(255, 255, 255, 0.1);
      color: var(--primary-color);
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      -webkit-text-fill-color: var(--primary-color);
      border: 1px solid rgba(99, 102, 241, 0.3);
      font-weight: 600;
    }

    .filters {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .filter-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      padding: 0.5rem 1rem;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 500;
      transition: var(--transition-fast);
    }

    .filter-btn:hover {
      color: white;
      background: var(--glass-bg);
    }

    .filter-btn.active {
      color: white;
      background: rgba(99, 102, 241, 0.2);
    }

    .link-list {
      max-height: 600px;
      overflow-y: auto;
      padding-right: 0.5rem;
    }

    .stats {
      margin-top: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .clear-btn {
      background: transparent;
      border: none;
      color: rgba(239, 68, 68, 0.6);
      cursor: pointer;
      font-size: 0.9rem;
      transition: var(--transition-fast);
    }

    .clear-btn:hover {
      color: var(--danger-color);
      text-decoration: underline;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 0;
      color: var(--text-muted);
    }

    .empty-state svg {
      width: 48px;
      height: 48px;
      margin-bottom: 1rem;
      opacity: 0.2;
    }
  `];

  async _fetchMetadata(url) {
    // Try our backend scraping endpoint first
    const scrapeEndpoint = 'https://websocket-relay.c-dinsmore.workers.dev/scrape';

    try {
      console.log('Fetching article via backend scraper...');
      const response = await fetch(scrapeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✓ Successfully fetched using backend scraper');
        return data;
      } else {
        const error = await response.json();
        console.warn('Backend scraper failed:', error);
      }
    } catch (e) {
      console.warn('Backend scraper error:', e.message);
    }

    // Fallback to CORS proxies if backend fails
    console.log('Falling back to CORS proxies...');
    const proxies = [
      {
        name: 'AllOrigins',
        getUrl: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        parseResponse: async (response) => {
          const data = await response.json();
          return data.contents;
        }
      },
      {
        name: 'ThingProxy',
        getUrl: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
        parseResponse: async (response) => await response.text()
      },
      {
        name: 'CORS.SH',
        getUrl: (url) => `https://cors.sh/${url}`,
        parseResponse: async (response) => await response.text()
      }
    ];

    // Try each proxy until one succeeds
    for (const proxy of proxies) {
      try {
        console.log(`Trying ${proxy.name} proxy...`);
        const proxyUrl = proxy.getUrl(url);
        const response = await fetch(proxyUrl, {
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (!response.ok) {
          console.warn(`${proxy.name} returned ${response.status}`);
          continue;
        }

        const html = await proxy.parseResponse(response);
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const title = doc.querySelector('title')?.innerText ||
          doc.querySelector('meta[property="og:title"]')?.content ||
          url;

        const description = doc.querySelector('meta[name="description"]')?.content ||
          doc.querySelector('meta[property="og:description"]')?.content ||
          'No summary available.';

        // Basic content extraction (filtering out small navigational text)
        const paragraphs = Array.from(doc.querySelectorAll('p, article, h1, h2, h3, h4, h5, h6'))
          .filter(el => el.innerText.length > 50) // Filter out menu items/noise
          .map(p => p.innerText);

        const content = paragraphs.join('\n\n').substring(0, 100000) || 'Could not parse article content.';

        console.log(`✓ Successfully fetched using ${proxy.name}`);
        return { title, summary: description.substring(0, 300) + '...', content };
      } catch (e) {
        console.warn(`${proxy.name} failed:`, e.message);
        // Continue to next proxy
      }
    }

    // All methods failed
    console.error('All scraping methods failed for:', url);
    return { title: url, summary: 'Failed to fetch article. All methods unavailable.', content: '' };
  }

  async _addLink(e) {
    const url = e.detail.url;
    const placeholder = {
      id: this._generateId(),
      url,
      read: false,
      timestamp: Date.now(),
      title: 'Fetching...',
      summary: 'Preparing your article for offline view...',
      content: ''
    };

    this.yarray.push([placeholder]);

    // Fetch full data in background
    const meta = await this._fetchMetadata(url);

    // Update the record with actual data
    this.ydoc.transact(() => {
      // Re-find the index as it might have changed
      const currentList = this.yarray.toArray();
      const index = currentList.findIndex(item => item.id === placeholder.id);

      if (index !== -1) {
        this.yarray.delete(index, 1);
        this.yarray.insert(index, [{ ...placeholder, ...meta }]);
      } else {
        console.warn('Could not find placeholder item to update for:', url);
      }
    });
  }

  _toggleRead(e) {
    const id = e.detail.id;
    const index = this._links.findIndex(l => l.id === id);
    if (index !== -1) {
      const link = this.yarray.get(index);
      this.yarray.delete(index, 1);
      this.yarray.insert(index, [{ ...link, read: !link.read }]);
    }
  }

  _deleteLink(e) {
    const id = e.detail.id;
    const index = this._links.findIndex(l => l.id === id);
    if (index !== -1) {
      this.yarray.delete(index, 1);
    }
  }

  _clearRead() {
    for (let i = this.yarray.length - 1; i >= 0; i--) {
      if (this.yarray.get(i).read) {
        this.yarray.delete(i, 1);
      }
    }
  }

  _openReader(e) {
    console.log('Opening reader for:', e.detail.id);
    this._activeArticleId = e.detail.id;
    this._currentView = 'reader';
  }

  _closeReader() {
    console.log('Closing reader');
    this._currentView = 'list';
    this._activeArticleId = null;
  }

  get filteredLinks() {
    let sorted = [...this._links].sort((a, b) => b.timestamp - a.timestamp);
    switch (this._filter) {
      case 'unread':
        return sorted.filter(link => !link.read);
      case 'read':
        return sorted.filter(link => link.read);
      default:
        return sorted;
    }
  }

  render() {
    if (this._currentView === 'reader') {
      const article = this._links.find(l => l.id === this._activeArticleId);
      return html`
        <div class="container">
          <reader-view .article=${article} @close-reader=${() => this._closeReader()}></reader-view>
        </div>
      `;
    }

    const unreadCount = this._links.filter(l => !l.read).length;

    return html`
      <div class="container">
        <div class="header-actions">
          ${this._installPrompt ? html`
            <button class="settings-btn" @click=${() => this._installPwa()} title="Install App" style="color: var(--primary-color);">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          ` : ''}
          <div class="sync-indicator">
            <div class="sync-dot" style="background: ${this._synced ? '#10b981' : '#f59e0b'}; box-shadow: 0 0 10px ${this._synced ? '#10b981' : '#f59e0b'};"></div>
            <span>${this._synced ? 'P2P Live' : 'Connecting...'}</span>
          </div>
          <button class="settings-btn" @click=${() => this._showSettings = !this._showSettings} title="Sync Settings">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1-1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>

        ${this._showSettings ? html`
          <div class="settings-panel">
            <h3>Sync Settings</h3>
            <div class="settings-input-group">
              <label>Your Sync Key (Click to Copy)</label>
              <div class="code-display" @click=${() => this._copyRoomId()} title="Click to copy">
                ${this._roomId}
              </div>
            </div>
            
            <div class="settings-input-group">
              <label>Join Another Device</label>
              <div class="input-row">
                <input type="text" class="text-input" placeholder="Paste Sync Key here..." id="newRoomId">
                <button class="save-btn" @click=${() => {
          const input = this.shadowRoot.getElementById('newRoomId');
          this._updateRoomId(input.value);
          input.value = '';
        }}>Join</button>
              </div>
            </div>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 1rem; line-height: 1.4;">
              Paste this key on another device to sync your reading list securely.
            </p>
          </div>
        ` : ''}

        <h1>Read Later <span class="version-badge">v31</span></h1>
        
        <link-input @save-link=${(e) => this._addLink(e)}></link-input>

        <div class="filters">
          <button class="filter-btn ${this._filter === 'all' ? 'active' : ''}" @click=${() => this._filter = 'all'}>All</button>
          <button class="filter-btn ${this._filter === 'unread' ? 'active' : ''}" @click=${() => this._filter = 'unread'}>To Read</button>
          <button class="filter-btn ${this._filter === 'read' ? 'active' : ''}" @click=${() => this._filter = 'read'}>Read</button>
        </div>

        <div class="link-list">
          ${this.filteredLinks.length > 0 ? html`
            ${this.filteredLinks.map(link => html`
              <link-item
                .id=${link.id}
                .url=${link.url}
                .read=${link.read}
                .title=${link.title}
                .summary=${link.summary}
                .timestamp=${link.timestamp}
                @toggle-read=${(e) => this._toggleRead(e)}
                @delete-link=${(e) => this._deleteLink(e)}
                @open-reader=${(e) => this._openReader(e)}
              ></link-item>
            `)}
          ` : html`
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <p>Your reading list is empty</p>
            </div>
          `}
        </div>

        <div class="stats">
          <span>${unreadCount} articles left</span>
          ${this._links.some(l => l.read) ? html`
            <button class="clear-btn" @click=${this._clearRead}>Clear read</button>
          ` : ''}
        </div>
      </div>
    `;
  }
}

customElements.define('read-later-app', ReadLaterApp);
