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
  }

  static styles = [
    sharedStyles,
    css`
    :host {
      display: block;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .back-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: transparent;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      font-weight: 500;
      transition: var(--transition-fast);
      padding: 0.5rem 1rem;
      border-radius: 12px;
    }

    .back-btn:hover {
      background: rgba(255, 255, 255, 0.05);
      color: white;
    }

    .controls {
      display: flex;
      gap: 0.75rem;
    }

    .article-container {
      max-width: 800px;
      margin: 0 auto;
      line-height: 1.8;
      font-family: 'Inter', serif;
      color: var(--text-main);
    }

    h1 {
      font-size: 2.5rem;
      line-height: 1.2;
      margin-bottom: 1rem;
      color: white;
    }

    .meta {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-bottom: 2.5rem;
      display: flex;
      gap: 1rem;
    }

    .content {
      font-size: 1.15rem;
      white-space: pre-wrap;
    }

    .audio-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.2rem;
      border-radius: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .listen {
      background: var(--primary-color);
      color: white;
      border: none;
    }

    .listen:hover {
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
      transform: translateY(-1px);
    }

    .stop {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .stop:hover {
      background: rgba(239, 68, 68, 0.3);
    }

    svg {
      width: 20px;
      height: 20px;
    }
  `];

  _handleBack() {
    console.log('reader-view: Going back to list');
    this._stopListening();
    this.dispatchEvent(new CustomEvent('close-reader', {
      bubbles: true,
      composed: true
    }));
  }

  _startListening() {
    if (!this.article) return;

    this.isListening = true;

    // Preparation for background playback on Android
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.article.title || 'Article',
        artist: new URL(this.article.url).hostname,
        album: 'Read Later'
      });

      navigator.mediaSession.setActionHandler('pause', () => this._stopListening());
      navigator.mediaSession.setActionHandler('stop', () => this._stopListening());
    }

    this.utterance = new SpeechSynthesisUtterance(this.article.content || this.article.title);
    this.utterance.onend = () => {
      this.isListening = false;
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
    };

    window.speechSynthesis.cancel(); // Clear any pending speech
    window.speechSynthesis.speak(this.utterance);

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }
  }

  _stopListening() {
    window.speechSynthesis.cancel();
    this.isListening = false;
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopListening();
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
