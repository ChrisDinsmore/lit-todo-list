import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../app-styles.js';

export class ReaderView extends LitElement {
  static properties = {
    article: { type: Object },
    isListening: { type: Boolean, state: true },
    isPaused: { type: Boolean, state: true }
  };

  constructor() {
    super();
    this.article = null;
    this.isListening = false;
    this.isPaused = false;
    this.utterance = null;
    this.wakeLock = null;
    this.chunks = [];
    this.currentChunkIndex = 0;
    this.silentAudio = null;
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

      .top-bar {
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

      .controls {
        display: flex;
        gap: 0.5rem;
      }

      .audio-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        cursor: pointer;
        transition: var(--transition-fast);
        font-weight: 500;
      }

      .audio-btn:hover {
        background: var(--primary-color);
        transform: translateY(-2px);
      }

      .audio-btn.stop {
        background: rgba(239, 68, 68, 0.2);
        color: #ef4444;
      }

      .audio-btn.stop:hover {
        background: rgba(239, 68, 68, 0.3);
      }

      .article-container {
        flex: 1;
        overflow-y: auto;
        padding-right: 0.5rem;
        line-height: 1.8;
        font-size: 1.1rem;
        color: var(--text-primary);
      }

      .article-container h1 {
        font-size: 2rem;
        margin-bottom: 1rem;
        line-height: 1.3;
        color: white;
      }

      .meta {
        color: var(--text-muted);
        font-size: 0.9rem;
        margin-bottom: 1rem;
        display: flex;
        gap: 0.5rem;
      }

      .content {
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
    this._stopPlayback(true);
    this.dispatchEvent(new CustomEvent('close-reader', {
      bubbles: true,
      composed: true
    }));
  }

  // A 1-second silent WAV file to keep the media session alive
  static SILENT_AUDIO_URL = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

  firstUpdated() {
    this.silentAudio = this.shadowRoot.getElementById('silent-audio');
  }

  _splitIntoChunks(text) {
    if (!text) return [];
    // Split by sentences, but keep the delimiter
    const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text];
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  async _toggleSpeech(forceStop = false) {
    if ((this.isListening && !this.isPaused) || forceStop) {
      this._stopPlayback(forceStop);
    } else if (this.isPaused && !forceStop) {
      this._resumePlayback();
    } else {
      this._startPlayback();
    }
  }

  async _startPlayback() {
    this.chunks = this._splitIntoChunks(this.article.content || this.article.title);
    this.currentChunkIndex = 0;
    this.isListening = true;
    this.isPaused = false;

    // 1. Play silent audio loop
    if (this.silentAudio) {
      try {
        await this.silentAudio.play();
      } catch (err) {
        console.error('Failed to play silent audio:', err);
      }
    }

    // 2. Wake Lock
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.error('Wake lock error:', err);
      }
    }

    // 3. Media Session
    this._setupMediaSession();

    // 4. Start first chunk
    this._speakChunk();
    this.requestUpdate();
  }

  _resumePlayback() {
    this.isPaused = false;
    if (this.silentAudio) this.silentAudio.play();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    this._speakChunk();
    this.requestUpdate();
  }

  _stopPlayback(reset = false) {
    window.speechSynthesis.cancel();
    if (this.silentAudio) {
      this.silentAudio.pause();
      if (reset) this.silentAudio.currentTime = 0;
    }

    if (reset) {
      this.isListening = false;
      this.isPaused = false;
      this.currentChunkIndex = 0;
      this._releaseWakeLock();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
    } else {
      this.isPaused = true;
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    }
    this.requestUpdate();
  }

  async _releaseWakeLock() {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
      } catch (err) {
        console.error('Failed to release wake lock:', err);
      }
    }
  }

  _setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.article.title,
        artist: 'Read Later',
        album: 'Article Reader',
        artwork: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.playbackState = 'playing';

      navigator.mediaSession.setActionHandler('play', () => this._resumePlayback());
      navigator.mediaSession.setActionHandler('pause', () => this._stopPlayback(false));
      navigator.mediaSession.setActionHandler('stop', () => this._stopPlayback(true));

      // Optional: Add skip forward/backward to chunks
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.currentChunkIndex = Math.max(0, this.currentChunkIndex - 1);
        this._speakChunk();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.currentChunkIndex = Math.min(this.chunks.length - 1, this.currentChunkIndex + 1);
        this._speakChunk();
      });
    }
  }

  _speakChunk() {
    window.speechSynthesis.cancel();

    if (this.currentChunkIndex >= this.chunks.length) {
      this._stopPlayback(true);
      return;
    }

    const text = this.chunks[this.currentChunkIndex];
    this.utterance = new SpeechSynthesisUtterance(text);

    // Use a slightly faster rate as default for long articles
    this.utterance.rate = 1.0;

    this.utterance.onend = () => {
      if (this.isListening && !this.isPaused) {
        this.currentChunkIndex++;
        this._speakChunk();
      }
    };

    this.utterance.onerror = (event) => {
      console.error('SpeechSynthesis error:', event);
      if (event.error !== 'interrupted') {
        this._stopPlayback(true);
      }
    };

    window.speechSynthesis.speak(this.utterance);
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
            <button class="audio-btn" @click=${() => this._toggleSpeech()}>
              ${this.isPaused ? html`
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Resume
              ` : html`
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                Pause
              `}
            </button>
            <button class="audio-btn stop" @click=${() => this._stopListening()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="6" y="6" width="12" height="12"></rect>
              </svg>
              Stop
            </button>
          ` : html`
            <button class="audio-btn" @click=${() => this._startListening()}>
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
        
        <!-- Hidden audio element to keep media session active on mobile -->
        <audio id="silent-audio" loop src="${ReaderView.SILENT_AUDIO_URL}" style="display: none;"></audio>
      </article>
    `;
  }
}

customElements.define('reader-view', ReaderView);
