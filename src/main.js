import './styles/tokens.css';
import './styles/base.css';
import { selectElement } from './core/dom.js';
import { mount } from './games/river-raid/index.js';

const canvas = selectElement('#game-canvas');
mount(canvas, { seed: 7 });
