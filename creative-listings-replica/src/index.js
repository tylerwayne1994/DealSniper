import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ListingsProvider } from './context/ListingsContext';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ListingsProvider>
        <App />
      </ListingsProvider>
    </BrowserRouter>
  </React.StrictMode>
);