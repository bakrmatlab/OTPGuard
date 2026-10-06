import { createRoot } from 'react-dom/client';
import Management from './management';
const root = document.getElementById('root');
if (!root) throw new Error('Management root unavailable');
createRoot(root).render(<Management />);
