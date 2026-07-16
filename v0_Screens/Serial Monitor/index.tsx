
import React from 'react';
import { createRoot } from 'react-dom/client';
import { SerialMonitor } from './components/serial-monitor';

const root = createRoot(document.getElementById('root')!);
root.render(<SerialMonitor />);
