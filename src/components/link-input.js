import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../app-styles.js';

export class LinkInput extends LitElement {
  static properties = {
    _value: { state: true }
  };

  constructor() {
    super();
    this._value = '';
  }

  static styles = [
    sharedStyles,
    css`
    :host {
      display: block;
      margin-bottom: 2rem;
    }

    .input-container {
      display: flex;
      gap: 1rem;
      background: var(--glass-bg);
      padding: 0.5rem;
      border-radius: 16px;
      border: 1px solid var(--glass-border);
      backdrop-filter: blur(var(--glass-blur));
      transition: var(--transition-normal);
    }

    .input-container:focus-within {
      border-color: rgba(99, 102, 241, 0.5);
      background: var(--glass-bg-hover);
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.1);
    }

    input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: white;
      font-size: 1rem;
      padding: 0.75rem 1rem;
      font-family: inherit;
    }

    input::placeholder {
      color: var(--text-muted);
    }

    svg {
      width: 18px;
      height: 18px;
    }
  `];

  _handleInput(e) {
    this._value = e.target.value;
  }

  _handleKeydown(e) {
    if (e.key === 'Enter') {
      this._submit();
    }
  }

  _isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  _submit() {
    const url = this._value.trim();
    if (url) {
      this.dispatchEvent(new CustomEvent('save-link', {
        detail: { url },
        bubbles: true,
        composed: true
      }));
      this._value = '';
    }
  }

  render() {
    const isValid = this._isValidUrl(this._value.trim());
    const isEmpty = this._value.trim() === '';

    return html`
      <div class="input-container">
        <input 
          type="text" 
          placeholder="Paste an article URL to save..." 
          .value=${this._value}
          @input=${(e) => this._handleInput(e)}
          @keydown=${(e) => this._handleKeydown(e)}
        />
        <button 
          class="primary-button" 
          ?disabled=${isEmpty || !isValid} 
          @click=${() => this._submit()} 
          style="padding: 0 1.5rem; display: flex; align-items: center; gap: 0.5rem;"
          title=${!isValid && !isEmpty ? 'Please enter a valid URL' : 'Save Link'}
        >
          <span>Save</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    `;
  }
}

customElements.define('link-input', LinkInput);
