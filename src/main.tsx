import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {setupAppUpdates} from './lib/appUpdate';

createRoot(document.getElementById('root')!).render(<App />);

// Registra o service worker e mantém o app sempre na versão mais nova
setupAppUpdates();
