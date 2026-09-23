import './styles/tokens.css';
import './styles/base.css';
import { selectElement } from './core/dom.js';

const canvas = selectElement('#game-canvas');
const context = canvas.getContext('2d');

if (context) {
  context.fillStyle = '#0a0a12';
  context.fillRect(0, 0, canvas.width, canvas.height);
}
