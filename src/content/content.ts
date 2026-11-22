// @trace DD-counter-001
// コンテンツスクリプトのサンプル。対象ページは manifest.json の matches で限定する。

import type { Message } from '../shared/messages';

const ping: Message = { type: 'PING' };
void chrome.runtime.sendMessage(ping);
