import { createRoot } from 'react-dom/client';
import Popup from './popup';

const root = document.getElementById('root');
if (!root) throw new Error('Popup root unavailable');
createRoot(root).render(<Popup />);
