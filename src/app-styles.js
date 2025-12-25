import { css } from 'lit';

export const sharedStyles = css`
  .glass-panel {
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border: 1px solid var(--glass-border);
  }

  .primary-button {
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .primary-button:hover {
    background: var(--primary-hover);
    transform: scale(1.02);
  }

  .primary-button:active {
    transform: scale(0.98);
  }

  .primary-button:disabled {
    background: var(--glass-bg);
    color: var(--text-muted);
    cursor: not-allowed;
    transform: none;
  }
`;
