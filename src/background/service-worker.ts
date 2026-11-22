// @trace DD-counter-001
// Service Worker。常駐しないため状態は chrome.storage に保存する。
// リスナーはトップレベルで同期的に登録する。

import { increment } from '../shared/counter';
import { getNumber, setNumber } from '../shared/chrome/storage';
import type { Message } from '../shared/messages';

const COUNT_KEY = 'count';

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  void (async () => {
    switch (message.type) {
      case 'PING':
        sendResponse({ ok: true });
        return;
      case 'GET_COUNT':
        sendResponse({ count: await getNumber(COUNT_KEY) });
        return;
      case 'INCREMENT': {
        const next = increment(await getNumber(COUNT_KEY));
        await setNumber(COUNT_KEY, next);
        sendResponse({ count: next });
        return;
      }
    }
  })();
  return true; // 非同期で sendResponse するため
});
