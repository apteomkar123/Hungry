import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // <-- Add this exact line to inject your styles!
import { UserProvider } from './components/UserContext';

// Preserve ?recipe= param before any auth redirect can modify the URL
const _rl = new URLSearchParams(window.location.search).get('recipe');
if (_rl) sessionStorage.setItem('_pendingRecipeId', _rl);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UserProvider>
      <App />
    </UserProvider>
  </React.StrictMode>,
)