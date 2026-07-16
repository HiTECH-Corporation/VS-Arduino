
import React from 'react';
import { createRoot } from 'react-dom/client';
import { SerialPlotter } from './components/serial-plotter';

const root = createRoot(document.getElementById('root')!);
root.render(<SerialPlotter />);
