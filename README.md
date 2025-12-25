# Read Later App

A beautiful, offline-capable "Read Later" application built with Lit, Yjs, and standard Web Components.

## Features

- **Save Articles**: Paste a URL to fetch its title, summary, and content (using a proxy).
- **Offline Reading**: Articles are saved to IndexedDB correctly.
- **Reader View**: Distraction-free reading experience with Text-to-Speech support.
- **Sync**: Uses WebRTC for peer-to-peer syncing between devices (when both are online).
- **PWA**: Installable on mobile and desktop.

## How to Deploy (Private)

This repository includes a GitHub Actions workflow to deploy automatically to GitHub Pages.

1.  **Create a Repository**: Create a new **public** repository on GitHub.
2.  **Push Code**:
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin https://github.com/<YOUR_USERNAME>/<REPO_NAME>.git
    git push -u origin main
    ```
3.  **Enable Pages**:
    - Go to your Repository **Settings**.
    - Click **Pages** in the sidebar.
    - Under **Build and deployment**, select **GitHub Actions** as the source.
    - The action will run automatically. Once finished, you will see your URL!

## Privacy Note
The synchronization uses a unique Room ID generated for this instance (`read-later-b29a8c14...`). This acts as a password. Only devices with this specific code version (and Room ID) will sync with each other.
