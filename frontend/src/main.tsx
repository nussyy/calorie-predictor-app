import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx' // Ensure it points to .tsx
import './App.css'       // CSS import remains the same

// Use non-null assertion (!) if you are certain 'root' element exists
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)