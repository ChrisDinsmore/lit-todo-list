import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../app-styles.js';
import { TTSEngine } from '../lib/tts-engine.js';

export class ReaderView extends LitElement {
  static properties = {
    article: { type: Object },
    isListening: { type: Boolean, state: true },
    isPaused: { type: Boolean, state: true },
    isSynthesizing: { type: Boolean, state: true }
  };

  constructor() {
    super();
    this.article = null;
    this.isListening = false;
    this.isPaused = false;
    this.isSynthesizing = false;
    this.wakeLock = null;
    this.chunks = [];
    this.currentChunkIndex = 0;
    this.audioElement = null;
    this.tts = new TTSEngine();
    this.audioUrls = new Map(); // Store blob URLs
  }

  firstUpdated() {
    this.audioElement = this.shadowRoot.getElementById('main-audio');

    // Add event listeners for audio element
    this.audioElement.onended = () => this._onAudioEnded();
    this.audioElement.onerror = () => {
      const err = this.audioElement.error;
      console.error('Audio element error:', {
        code: err?.code,
        message: err?.message,
        src: this.audioElement.src
      });
    };
  }

  _splitIntoChunks(text) {
    if (!text) return [];
    // Split by sentences
    const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text];
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  async _toggleSpeech(forceStop = false) {
    if (forceStop) {
      this._stopPlayback(true);
      return;
    }

    if (this.isListening && !this.isPaused) {
      this._pausePlayback();
    } else if (this.isPaused) {
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

    // Wake Lock
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.error('Wake lock error:', err);
      }
    }

    this._setupMediaSession();
    this._playNextChunk();
    this.requestUpdate();
  }

  async _playNextChunk() {
    if (this.currentChunkIndex >= this.chunks.length) {
      this._stopPlayback(true);
      return;
    }

    this.isSynthesizing = true;
    this.requestUpdate();

    try {
      const text = this.chunks[this.currentChunkIndex];
      let audioUrl = this.audioUrls.get(this.currentChunkIndex);

      if (!audioUrl) {
        const { buffer } = await this.tts.synthesize(text);
        const blob = this.tts.createWavBlob(buffer);
        audioUrl = URL.createObjectURL(blob);
        this.audioUrls.set(this.currentChunkIndex, audioUrl);
      }

      this.isSynthesizing = false;
      this.audioElement.src = audioUrl;
      await this.audioElement.play();

      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }

      // Pre-synthesize next chunk
      this._preSynthesizeNext();

    } catch (err) {
      console.error('Playback error:', err);
      this._stopPlayback(true);
    }

    this.requestUpdate();
  }

  async _preSynthesizeNext() {
    const nextIndex = this.currentChunkIndex + 1;
    if (nextIndex < this.chunks.length && !this.audioUrls.has(nextIndex)) {
      try {
        const { buffer } = await this.tts.synthesize(this.chunks[nextIndex]);
        const blob = this.tts.createWavBlob(buffer);
        this.audioUrls.set(nextIndex, URL.createObjectURL(blob));
      } catch (e) {
        console.warn('Pre-synthesis failed', e);
      }
    }
  }

  _onAudioEnded() {
    if (this.isListening && !this.isPaused) {
      this.currentChunkIndex++;
      this._playNextChunk();
    }
  }

  _pausePlayback() {
    this.isPaused = true;
    this.audioElement.pause();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    this.requestUpdate();
  }

  _resumePlayback() {
    this.isPaused = false;
    this.audioElement.play();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    this.requestUpdate();
  }

  _stopPlayback(reset = false) {
    this.audioElement.pause();
    this.audioElement.src = '';

    if (reset) {
      this.isListening = false;
      this.isPaused = false;
      this.currentChunkIndex = 0;
      this._releaseWakeLock();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';

      // Clear blobs
      this.audioUrls.forEach(url => URL.revokeObjectURL(url));
      this.audioUrls.clear();
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
      } catch (err) { }
    }
  }

  _setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.article.title,
        artist: 'Read Later',
        album: 'Offline Reader',
        artwork: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => this._resumePlayback());
      navigator.mediaSession.setActionHandler('pause', () => this._pausePlayback());
      navigator.mediaSession.setActionHandler('stop', () => this._stopPlayback(true));

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.currentChunkIndex = Math.max(0, this.currentChunkIndex - 1);
        this._playNextChunk();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.currentChunkIndex = Math.min(this.chunks.length - 1, this.currentChunkIndex + 1);
        this._playNextChunk();
      });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopPlayback(true);
  }

  _startListening() {
    this._toggleSpeech();
  }

  _stopListening() {
    this._stopPlayback(true);
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

      .audio-btn.synthesizing {
        opacity: 0.7;
        cursor: wait;
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

      .status-pill {
        font-size: 0.7rem;
        padding: 0.2rem 0.5rem;
        border-radius: 10px;
        background: rgba(99, 102, 241, 0.2);
        color: var(--primary-color);
        margin-left: 1rem;
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
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            List
          </button>
          <a class="back-btn" href=${this.article.url} target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            Source
          </a>
        </div>

        <div class="controls">
          ${this.isListening ? html`
            <button class="audio-btn ${this.isSynthesizing ? 'synthesizing' : ''}" @click=${() => this._toggleSpeech()} ?disabled=${this.isSynthesizing}>
              ${this.isSynthesizing ? html`...` : (this.isPaused ? html`Resume` : html`Pause`)}
            </button>
            <button class="audio-btn stop" @click=${() => this._stopListening()}>Stop</button>
          ` : html`
            <button class="audio-btn" @click=${() => this._startListening()}>Listen</button>
          `}
        </div>
      </div>

      <article class="article-container">
        <div class="meta">
          <span>${new URL(this.article.url).hostname}</span>
          <span>•</span>
          <span>${date}</span>
          ${this.isSynthesizing ? html`<span class="status-pill">Synthesizing...</span>` : ''}
        </div>
        <h1>${this.article.title || 'Untitled Article'}</h1>
        <div class="content">
          ${this.article.content || 'No content found for this article.'}
        </div>
        
        <audio id="main-audio" style="display: none;"></audio>
      </article>
    `;
  }
}

customElements.define('reader-view', ReaderView);
