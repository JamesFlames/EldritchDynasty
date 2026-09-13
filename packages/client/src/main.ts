import { createApp } from 'vue';
import App from './App.vue';
import { installPlatform, platformForWindow } from './platform.js';
import './styles.css';

// Host selection happens once, before any client state exists. Nothing below
// this composition root asks where it is running.
const platform = platformForWindow();
installPlatform(platform);

// The root component already owns Escape's order: book, line, marks, open
// card. Sending a host back gesture through that route keeps a second overlay
// stack from growing in a shell. At the bottom there is nothing to dismiss, so
// the host may perform its normal exit behaviour.
platform.onBack(() => {
  const dismissible = document.querySelector('[role="dialog"], .keys, .member.open') !== null;
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  return dismissible;
});
createApp(App).mount('#app');
