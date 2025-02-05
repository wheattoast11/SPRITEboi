import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/serviceWorker.js')
      .then(registration => {
        console.log('ServiceWorker registered:', registration);
        
        // Request notification permission
        if ('Notification' in window) {
          Notification.requestPermission();
        }
        
        // Register for background sync
        if ('sync' in registration) {
          registration.sync.register('sync-generations');
        }
      })
      .catch(error => {
        console.error('ServiceWorker registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
