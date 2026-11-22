#!/usr/bin/env node
// トレーサビリティ表の生成と整合性チェック（依存ライブラリなし）
//
//   node scripts/trace.mjs          … docs/traceability.md を再生成し、問題を表示
//   node scripts/trace.mjs --check  … 問題があれば終了コード 1（CI 用）
//
// 対象:
//   docs/**/*.md の front matter（id / status / trace）
//   src/**, tests/** の `@trace <ID>` コメント

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CHECK = process.argv.includes('--check');
const SKIP_DOCS = new Set(['_template.md', 'README.md', 'index.md', 'traceability.md']);
const STATUSES = ['draft', 'review', 'approved', 'deprecated'];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const rel = (p) => relative(ROOT, p).split(sep).join('/');

// ---- 1. 設計書の front matter を読む ----
function parseFrontMatter(text, file) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^(\w+):\s*(.*?)\s*(#.*)?$/);
    if (!kv) continue;
    let v = kv[2].replace(/^["']|["']$/g, '');
    if (kv[1] === 'trace') {
      if (!v && i + 1 < lines.length && /^\s+\[/.test(lines[i + 1])) {
        v = lines[++i].trim();
      }
      while (v.startsWith('[') && !v.includes(']') && i + 1 < lines.length && /^\s/.test(lines[i + 1])) {
        v += lines[++i].trim();
      }
      if (!v.startsWith('[') || !v.endsWith(']')) {
        throw new Error(`trace の配列が不正です: ${rel(file)}`);
      }
    }
    if (v.startsWith('[')) {
      v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
    fm[kv[1]] = v;
  }
  return fm;
}

const docs = new Map(); // id -> { id, title, status, trace[], file }
const problems = [];

for (const file of walk(join(ROOT, 'docs')).filter((f) => f.endsWith('.md'))) {
  if (SKIP_DOCS.has(file.split(sep).pop()) || rel(file).startsWith('docs/00_steering/')) continue;
  const fm = parseFrontMatter(readFileSync(file, 'utf8'), file);
  if (!fm?.id) {
    problems.push(`front matter に id がありません: ${rel(file)}`);
    continue;
  }
  if (docs.has(fm.id)) problems.push(`ID が重複しています: ${fm.id}（${rel(file)} / ${docs.get(fm.id).file}）`);
  if (!STATUSES.includes(fm.status)) problems.push(`status が不正です: ${fm.id} = "${fm.status}"`);
  docs.set(fm.id, {
    id: fm.id,
    title: fm.title ?? '',
    status: fm.status,
    trace: Array.isArray(fm.trace) ? fm.trace : [],
    file: rel(file),
  });
}

// ---- 2. コード・テストの @trace を読む ----
const codeRefs = new Map(); // id -> Set(file)
for (const base of ['src', 'tests']) {
  let files = [];
  try { files = walk(join(ROOT, base)); } catch { continue; }
  for (const file of files.filter((f) => /\.(ts|tsx|js|mjs|vue|html)$/.test(f))) {
    for (const [, id] of readFileSync(file, 'utf8').matchAll(/@trace\s+([A-Z]+(?:-[A-Za-z0-9]+)+)/g)) {
      if (!codeRefs.has(id)) codeRefs.set(id, new Set());
      codeRefs.get(id).add(rel(file));
    }
  }
}

// ---- 3. 整合性チェック ----
const kind = (id) => id.split('-')[0];
for (const d of docs.values()) {
  for (const up of d.trace) {
    const u = docs.get(up);
    if (!u) { problems.push(`${d.id}: 存在しない上流 ID を参照しています → ${up}`); continue; }
    // 承認ゲート: 下流が review/approved なのに上流が approved でない
    if (['review', 'approved'].includes(d.status) && u.status !== 'approved') {
      problems.push(`承認ゲート違反: ${d.id}(${d.status}) の上流 ${up} が ${u.status} です`);
    }
  }
}
for (const [id, files] of codeRefs) {
  const d = docs.get(id);
  const where = [...files].join(', ');
  if (!d) problems.push(`コード/テストが存在しない ID を参照しています: ${id}（${where}）`);
  else if (d.status !== 'approved') problems.push(`未承認の設計に基づくコード/テストがあります: ${id}(${d.status}) ← ${where}`);
}
const downstreamOf = (id) => [...docs.values()].filter((d) => d.trace.includes(id));
for (const d of docs.values()) {
  if (d.status === 'deprecated') continue;
  if ((kind(d.id) === 'FR' || kind(d.id) === 'NFR') && !downstreamOf(d.id).some((x) => kind(x.id) === 'BD'))
    problems.push(`基本設計に未反映の要件: ${d.id}`);
  if ((kind(d.id) === 'FR' || kind(d.id) === 'NFR') && !downstreamOf(d.id).some((x) => kind(x.id) === 'TS'))
    problems.push(`テスト設計の無い要件: ${d.id}`);
}

// ---- 4. 表の生成 ----
const label = (id) => {
  const d = docs.get(id);
  return d ? `${id} (${d.status})` : `${id} (不明)`;
};
const rows = [];
const reqs = [...docs.values()].filter((d) => ['FR', 'NFR'].includes(kind(d.id))).sort((a, b) => a.id.localeCompare(b.id));
for (const r of reqs) {
  const bds = downstreamOf(r.id).filter((x) => kind(x.id) === 'BD');
  const dds = bds.flatMap((b) => downstreamOf(b.id).filter((x) => kind(x.id) === 'DD'));
  const tss = [...new Set([r, ...dds].flatMap((x) => downstreamOf(x.id).filter((y) => kind(y.id) === 'TS')))];
  const code = [...new Set([...bds, ...dds].flatMap((x) => [...(codeRefs.get(x.id) ?? [])]).filter((f) => f.startsWith('src/')))];
  const tests = [...new Set(tss.flatMap((x) => [...(codeRefs.get(x.id) ?? [])]))];
  rows.push(
    `| ${label(r.id)} ${r.title} | ${bds.map((x) => label(x.id)).join('<br>') || '**なし**'} | ${dds.map((x) => label(x.id)).join('<br>') || '-'} | ${tss.map((x) => label(x.id)).join('<br>') || '**なし**'} | ${code.map((f) => `\`${f}\``).join('<br>') || '-'} | ${tests.map((f) => `\`${f}\``).join('<br>') || '-'} |`,
  );
}

const md = `# トレーサビリティ表

> このファイルは \`npm run trace\` で自動生成されます。手で編集しないでください。

| 要件 | 基本設計 | 詳細設計 | テスト設計 | 実装 | テストコード |
|---|---|---|---|---|---|
${rows.join('\n') || '| （要件なし） | | | | | |'}

## 検出された問題（${problems.length} 件）

${problems.length ? problems.map((p) => `- ${p}`).join('\n') : '- なし'}
`;

writeFileSync(join(ROOT, 'docs', 'traceability.md'), md);
console.log(`docs/traceability.md を更新しました（要件 ${reqs.length} 件、問題 ${problems.length} 件）`);
for (const p of problems) console.log(`  - ${p}`);
if (CHECK && problems.length) process.exit(1);
