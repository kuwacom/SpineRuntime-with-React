import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import BasicSample from './BasicSample.tsx';
import './index.css';
import UseZipSample from './UseZipSample.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <h2>Basic Asset sample</h2>
    <BasicSample />
    <h2>Use Zip Asset sample</h2>
    <UseZipSample />
  </StrictMode>
);
