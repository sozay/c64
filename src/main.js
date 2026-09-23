import './styles/tokens.css';
import './styles/base.css';
import './styles/portal.css';
import { selectElement } from './core/dom.js';
import { mount } from './portal/index.js';

const app = selectElement('#app');
mount(app);
