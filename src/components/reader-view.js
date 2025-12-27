import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../app-styles.js';

export class ReaderView extends LitElement {
  static properties = {
    article: { type: Object }
  };

  constructor() {
    super();
    this.article = null;
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
