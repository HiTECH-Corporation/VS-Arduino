
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ControlPanel } from './components/control-panel';

const root = createRoot(document.getElementById('root')!);
root.render(<ControlPanel />);
