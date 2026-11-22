// @trace DD-counter-001

import type { Message } from '../shared/messages';

const countEl = document.querySelector<HTMLSpanElement>('[data-testid="count"]');
const button = document.querySelector<HTMLButtonElement>('[data-testid="increment"]');

async function send(message: Message): Promise<{ count: number }> {
  return chrome.runtime.sendMessage(message);
}

function render(count: number): void {
  if (countEl) countEl.textContent = String(count); // innerHTML は使わない
}

button?.addEventListener('click', () => {
  void send({ type: 'INCREMENT' }).then((res) => render(res.count));
});

void send({ type: 'GET_COUNT' }).then((res) => render(res.count));
