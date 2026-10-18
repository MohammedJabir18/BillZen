import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { initThemeBeforeMount } from './contexts/ThemeContext';

// Synchronously apply stored/system appearance before visible content paint
initThemeBeforeMount();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
