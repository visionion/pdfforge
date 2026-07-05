import './style.css';
import { mountApp } from './shell/app';

const root = document.getElementById('app');
if (root) {
  mountApp(root);
}
