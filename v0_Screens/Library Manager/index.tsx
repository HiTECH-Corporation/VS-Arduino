import React from 'react';
import { createRoot } from 'react-dom/client';
import { LibraryManager } from './components/library-manager/library-manager';

const root = createRoot(document.getElementById('root')!);
root.render(<LibraryManager />);
