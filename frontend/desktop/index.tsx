import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

import { useAppState } from './index/useAppState';
import { useAppEffects } from './index/useAppEffects';
import { useAppHandlers } from './index/useAppHandlers';
import AppLayout from './index/AppLayout';

const App = () => {
  const state = useAppState();
  useAppEffects(state);
  const handlers = useAppHandlers(state);

  return <AppLayout state={state} handlers={handlers} />;
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
