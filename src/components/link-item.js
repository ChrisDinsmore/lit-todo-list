import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../app-styles.js';

export class LinkItem extends LitElement {
  static properties = {
    url: { type: String },
    read: { type: Boolean },
    id: { type: String },
    title: { type: String },
    summary: { type: String },
    timestamp: { type: Number }
  };

  constructor() {
    super();
    this.url = '';
    this.read = false;
    this.id = '';
    this.title = '';
    this.summary = '';
    this.timestamp = Date.now();
  }

  static styles = [
    sharedStyles,
    css`
    :host {
      display: block;
      margin-bottom: 1rem;
    }

    .item {
      display: flex;
      gap: 1.25rem;
      padding: 1.25rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      transition: var(--transition-normal);
      position: relative;
      cursor: pointer;
    }

    .item:hover {
      background: var(--glass-bg-hover);
      transform: translateY(-2px);
      border-color: rgba(99, 102, 241, 0.3);
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.3);
    }

    .checkbox-container {
      display: flex;
      align-items: flex-start;
      margin-top: 0.25rem;
    }

    .checkbox {
      width: 22px;
      height: 22px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition-fast);
      flex-shrink: 0;
      cursor: pointer;
    }

    .item.read .checkbox {
      background: var(--primary-color);
      border-color: var(--primary-color);
    }

    .checkbox svg {
      width: 14px;
      height: 14px;
      fill: white;
      opacity: 0;
      transform: scale(0.5);
      transition: var(--transition-fast);
    }

    .item.read .checkbox svg {
      opacity: 1;
      transform: scale(1);
    }

    .content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .item-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: white;
      line-height: 1.4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-decoration: none;
    }

    .item.read .item-title {
      color: var(--text-muted);
      text-decoration: line-through;
    }

    .summary {
      font-size: 0.85rem;
      color: var(--text-secondary);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: 0.25rem;
    }

    .meta {
      font-size: 0.75rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .hostname {
      font-weight: 500;
      color: var(--primary-color);
      opacity: 0.8;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      opacity: 0;
      transform: translateX(10px);
      transition: var(--transition-normal);
      justify-content: center;
    }

    .item:hover .actions {
      opacity: 1;
      transform: translateX(0);
    }

    .action-btn {
      background: rgba(255, 255, 255, 0.05);
      border: none;
      color: var(--text-secondary);
      padding: 0.5rem;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition-fast);
      text-decoration: none;
    }

    .action-btn:hover {
      background: var(--glass-bg-hover);
      color: white;
    }

    .read-now-btn {
      background: rgba(99, 102, 241, 0.1);
      color: var(--primary-color);
      font-weight: 600;
      font-size: 0.8rem;
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      border: 1px solid rgba(99, 102, 241, 0.2);
    }

    .read-now-btn:hover {
      background: var(--primary-color);
      color: white;
    }

    .delete-btn:hover {
      background: rgba(239, 68, 68, 0.2);
      color: var(--danger-color);
    }

    svg.icon {
      width: 18px;
      height: 18px;
    }
  `];

  _handleToggle(e) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('toggle-read', {
      detail: { id: this.id },
      bubbles: true,
      composed: true
    }));
  }

  _handleDelete(e) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('delete-link', {
      detail: { id: this.id },
      bubbles: true,
      composed: true
    }));
  }

  _openReader(e) {
    e.preventDefault();
    console.log('link-item: Dispatching open-reader for', this.id);
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('open-reader', {
      detail: { id: this.id },
      bubbles: true,
      composed: true
    }));
  }

  _handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._openReader(e);
    }
  }

  _getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch (_) {
      return '';
    }
  }

  formatDate(ts) {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diff = (ts - Date.now()) / (1000 * 60 * 60 * 24);
    if (Math.abs(diff) < 1) {
      return 'Today';
    }
    return rtf.format(Math.floor(diff), 'day');
  }

  render() {
    const hostname = this._getHostname(this.url);

    return html`
      <div 
        class="item ${this.read ? 'read' : ''}" 
        @click=${(e) => this._openReader(e)}
        @keydown=${(e) => this._handleKeyDown(e)}
        role="button"
        tabindex="0"
      >
        <div class="checkbox-container">
          <div class="checkbox" @click=${(e) => this._handleToggle(e)} title=${this.read ? 'Mark as Unread' : 'Mark as Read'}>
            <svg viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          </div>
        </div>
        
        <div class="content">
          <div class="item-title">${this.title || this.url}</div>
          <div class="summary">${this.summary || 'Fetching article summary...'}</div>
            <div class="meta">
              <span>${this.formatDate(this.timestamp)}</span>
            </div>
        </div>

        <div class="actions">
          <button class="action-btn read-now-btn" @click=${(e) => this._openReader(e)} tabindex="-1">Read</button>
          <button class="action-btn delete-btn" @click=${(e) => this._handleDelete(e)} title="Delete" tabindex="-1">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }
}

customElements.define('link-item', LinkItem);
