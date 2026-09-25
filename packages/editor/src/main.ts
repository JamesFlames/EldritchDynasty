import { createApp } from 'vue';
import { hydrateUserContent } from './lib/content.js';
import './styles.css';

async function start() {
  await hydrateUserContent();
  const { default: App } = await import('./App.vue');
  createApp(App).mount('#app');
}

void start();
