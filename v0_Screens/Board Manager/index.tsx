import React from 'react';
import { createRoot } from 'react-dom/client';
import { BoardManager } from './components/board-manager/board-manager';

const root = createRoot(document.getElementById('root')!);
root.render(<BoardManager />);
