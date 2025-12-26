import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../app-styles.js';

export class ReaderView extends LitElement {
  static properties = {
    article: { type: Object },
    isListening: { type: Boolean, state: true }
  };

  constructor() {
    super();
    this.article = null;
    this.isListening = false;
    this.utterance = null;
    this.wakeLock = null;
  }

  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .reader-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .back-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1rem;
        padding: 0.5rem;
        border-radius: 8px;
        transition: var(--transition-fast);
      }

      .back-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        color: white;
      }

      .actions {
        display: flex;
        gap: 0.5rem;
      }

      .action-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: white;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: var(--transition-fast);
      }

      .action-btn:hover {
        background: var(--primary-color);
        transform: translateY(-2px);
      }

      .action-btn.active {
        background: var(--primary-color);
        box-shadow: 0 0 15px var(--primary-color);
        animation: pulse 2s infinite;
      }

      .article-content {
        flex: 1;
        overflow-y: auto;
        padding-right: 0.5rem;
        line-height: 1.8;
        font-size: 1.1rem;
        color: var(--text-primary);
      }

      .article-content h1 {
        font-size: 2rem;
        margin-bottom: 1rem;
        line-height: 1.3;
      }

      .article-meta {
        color: var(--text-muted);
        font-size: 0.9rem;
        margin-bottom: 2rem;
        display: flex;
        gap: 1rem;
      }

      .text-content {
        white-space: pre-wrap;
      }

      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
        100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
      }
    `
  ];

  _handleBack() {
    this._toggleSpeech(true); // Stop speech if running
    this.dispatchEvent(new CustomEvent('close-reader', {
      bubbles: true,
      composed: true
    }));
  }

  async _toggleSpeech(forceStop = false) {
    if (this.isListening || forceStop) {
      // Stop playback
      window.speechSynthesis.cancel();
      this.isListening = false;

      // Release wake lock
      if (this.wakeLock) {
        try {
          await this.wakeLock.release();
          this.wakeLock = null;
          console.log('Wake lock released');
        } catch (err) {
          console.error('Failed to release wake lock:', err);
        }
      }

      // Update media session
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    } else {
      // Start playback
      this.utterance = new SpeechSynthesisUtterance(this.article.content || this.article.title);

      // Request wake lock to keep screen on during playback
      if ('wakeLock' in navigator) {
        try {
          this.wakeLock = await navigator.wakeLock.request('screen');
          console.log('Wake lock acquired');

          // Re-acquire wake lock if it's released (e.g., tab becomes inactive)
          this.wakeLock.addEventListener('release', () => {
            console.log('Wake lock was released');
          });
        } catch (err) {
          console.error('Failed to acquire wake lock:', err);
        }
      }

      // Setup Media Session Metadata for notification controls
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: this.article.title,
          artist: 'Read Later',
          album: 'Article',
          artwork: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
          ]
        });

        navigator.mediaSession.playbackState = 'playing';

        // Handle media control actions
        navigator.mediaSession.setActionHandler('play', () => {
          if (!this.isListening) {
            this._toggleSpeech();
          }
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          if (this.isListening) {
            this._toggleSpeech();
          }
        });

        navigator.mediaSession.setActionHandler('stop', () => {
          this._toggleSpeech(true);
        });
      }

      // Handle speech end
      this.utterance.onend = async () => {
        this.isListening = false;
        this.requestUpdate();

        // Release wake lock when done
        if (this.wakeLock) {
          try {
            await this.wakeLock.release();
            this.wakeLock = null;
          } catch (err) {
            console.error('Failed to release wake lock:', err);
          }
        }

        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'none';
        }
      };

      // Start speaking
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(this.utterance);
      this.isListening = true;
    }
    this.requestUpdate();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._toggleSpeech(true);
  }

  _startListening() {
    this._toggleSpeech();
  }

  _stopListening() {
    this._toggleSpeech(true);
  }


  render() {
    if (!this.article) return html`<div>Loading...</div>`;

    const date = new Date(this.article.timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return html`
      <div class="top-bar">
        <div style="display: flex; gap: 0.5rem;">
          <button class="back-btn" @click=${() => this._handleBack()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            List
          </button>
          <a class="back-btn" href=${this.article.url} target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            Source
          </a>
        </div>

        <div class="controls">
          ${this.isListening ? html`
            <button class="audio-btn stop" @click=${() => this._stopListening()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="6" y="6" width="12" height="12"></rect>
              </svg>
              Stop
            </button>
          ` : html`
            <button class="audio-btn listen" @click=${() => this._startListening()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
              Listen
            </button>
          `}
        </div>
      </div>

      <article class="article-container">
        <div class="meta">
          <span>${new URL(this.article.url).hostname}</span>
          <span>•</span>
          <span>${date}</span>
        </div>
        <h1>${this.article.title || 'Untitled Article'}</h1>
        <div class="content">
          ${this.article.content || 'No content found for this article.'}
        </div>
      </article>
    `;
  }
}

customElements.define('reader-view', ReaderView);
