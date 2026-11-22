// @trace DD-counter-001
// chrome.storage の薄いラッパー。テストではこのモジュールをモックする。

export async function getNumber(key: string, fallback = 0): Promise<number> {
  const result = await chrome.storage.local.get(key);
  const value: unknown = result[key];
  return typeof value === 'number' ? value : fallback;
}

export async function setNumber(key: string, value: number): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}
