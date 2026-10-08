import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { loadConfig } from './config';

void loadConfig()
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  })
  .catch((error: unknown) => {
    const root = document.getElementById('root')!;
    root.setAttribute('role', 'alert');
    root.textContent = error instanceof Error ? error.message : 'API接続設定が不正です。';
  });
