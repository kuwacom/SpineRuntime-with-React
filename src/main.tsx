import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import BasicSample from './BasicSample.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BasicSample />
  </StrictMode>
);
