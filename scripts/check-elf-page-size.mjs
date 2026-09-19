#!/usr/bin/env node
/**
 * Checks native libraries for 16 KB page-size compatibility.
 *
 * Usage:
 *   node scripts/check-elf-page-size.mjs <path> [--json]
 *
 * <path> may be a single .so, a directory (searched recursively), or an
 * APK / AAB / AAR / ZIP archive. No external tools (NDK, readelf) are needed.
 *
 * What is checked, per library:
 *  - every PT_LOAD program header must have p_align >= 16384 (0x4000). This is
 *    the criterion Android's own checker applies for 16 KB devices.
 *  - for APKs only: uncompressed (stored) .so entries must start at a file
 *    offset that is a multiple of 16384 (zipalign -P 16).
 *
 * Only 64-bit ABIs (arm64-v8a, x86_64) gate the result: 16 KB page size is a
 * 64-bit-only device mode, so 32-bit libraries are reported but never fail.
 * Exit code: 0 = all 64-bit libraries pass, 1 = at least one fails, 2 = usage.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const PAGE = 16384;
const SIXTY_FOUR = new Set(['arm64-v8a', 'x86_64']);

function readElfLoadAlignments(buf) {
  if (buf.length < 64 || buf.readUInt32BE(0) !== 0x7f454c46) {
    return {error: 'not an ELF file'};
  }
  const is64 = buf[4] === 2;
  const le = buf[5] === 1;
  if (!le) {
    return {error: 'big-endian ELF is not supported'};
  }
  const u16 = o => buf.readUInt16LE(o);
  const u32 = o => buf.readUInt32LE(o);
  const u64 = o => Number(buf.readBigUInt64LE(o));
  const phoff = is64 ? u64(0x20) : u32(0x1c);
  const phentsize = is64 ? u16(0x36) : u16(0x2a);
  const phnum = is64 ? u16(0x38) : u16(0x2c);
  const aligns = [];
  for (let i = 0; i < phnum; i++) {
    const o = phoff + i * phentsize;
    if (o + phentsize > buf.length) {
      return {error: 'truncated program headers'};
    }
    if (u32(o) === 1 /* PT_LOAD */) {
      aligns.push(is64 ? u64(o + 48) : u32(o + 28));
    }
  }
  return {is64, aligns};
}

// ---- minimal ZIP reader (central directory; deflate/stored) -----------------
function readZipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error('not a zip archive (no end-of-central-directory record)');
  }
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || off === 0xffffffff) {
    throw new Error('ZIP64 archives are not supported by this script');
  }
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) {
      throw new Error('corrupt central directory');
    }
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    entries.push({name, method, csize, localOff});
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function zipEntryData(buf, e) {
  const nameLen = buf.readUInt16LE(e.localOff + 26);
  const extraLen = buf.readUInt16LE(e.localOff + 28);
  const dataOff = e.localOff + 30 + nameLen + extraLen;
  const raw = buf.subarray(dataOff, dataOff + e.csize);
  return {
    dataOff,
    data: e.method === 0 ? raw : e.method === 8 ? zlib.inflateRawSync(raw) : null,
  };
}

function abiOf(p) {
  const m = p.replace(/\\/g, '/').match(/(?:^|\/)(?:lib|jni)\/([^/]+)\/[^/]+\.so$/);
  return m ? m[1] : 'unknown';
}

// ---- collect --------------------------------------------------------------
function* walk(dir) {
  for (const ent of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* walk(p);
    } else if (ent.name.endsWith('.so')) {
      yield p;
    }
  }
}

function collect(target) {
  const results = [];
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const f of walk(target)) {
      results.push({name: path.relative(target, f), abi: abiOf(f), ...readElfLoadAlignments(fs.readFileSync(f))});
    }
  } else if (/\.(apk|aab|aar|zip)$/i.test(target)) {
    const buf = fs.readFileSync(target);
    const isApk = /\.apk$/i.test(target);
    for (const e of readZipEntries(buf)) {
      if (!e.name.endsWith('.so')) {
        continue;
      }
      const {data, dataOff} = zipEntryData(buf, e);
      const r = data ? readElfLoadAlignments(data) : {error: `unsupported compression ${e.method}`};
      const item = {name: e.name, abi: abiOf(e.name), ...r};
      if (isApk && e.method === 0) {
        item.zipAligned16k = dataOff % PAGE === 0;
      }
      results.push(item);
    }
  } else if (target.endsWith('.so')) {
    results.push({name: path.basename(target), abi: abiOf(target), ...readElfLoadAlignments(fs.readFileSync(target))});
  } else {
    throw new Error('unsupported input (expected .so, directory, .apk, .aab, .aar or .zip)');
  }
  return results;
}

// ---- main -----------------------------------------------------------------
const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith('--'));
if (!target || !fs.existsSync(target)) {
  console.error('usage: node scripts/check-elf-page-size.mjs <.so | dir | .apk | .aab | .aar> [--json]');
  process.exit(2);
}

const libs = collect(target);
let failures = 0;
const rows = libs.map(l => {
  const required = SIXTY_FOUR.has(l.abi) || (l.is64 === true && l.abi === 'unknown');
  let status;
  if (l.error) {
    status = 'ERROR';
  } else {
    const minAlign = Math.min(...l.aligns);
    l.minAlign = minAlign;
    const elfOk = minAlign >= PAGE;
    const zipOk = l.zipAligned16k === undefined || l.zipAligned16k;
    status = elfOk && zipOk ? 'PASS' : required ? 'FAIL' : 'n/a (32-bit)';
    if (!elfOk && !required) {
      status = 'n/a (32-bit)';
    }
    if (required && (!elfOk || !zipOk)) {
      status = 'FAIL';
    }
  }
  if (status === 'FAIL' || (status === 'ERROR' && required)) {
    failures++;
  }
  return {...l, required, status};
});

if (args.includes('--json')) {
  console.log(JSON.stringify({target, failures, libraries: rows}, null, 2));
} else {
  const w = Math.max(10, ...rows.map(r => r.name.length));
  console.log(`${'library'.padEnd(w)}  abi          min p_align  zip16k  result`);
  for (const r of rows.sort((a, b) => a.abi.localeCompare(b.abi) || a.name.localeCompare(b.name))) {
    const align = r.error ? r.error : String(r.minAlign);
    const zip = r.zipAligned16k === undefined ? '-' : r.zipAligned16k ? 'yes' : 'NO';
    console.log(`${r.name.padEnd(w)}  ${r.abi.padEnd(12)} ${align.padEnd(11)} ${zip.padEnd(6)}  ${r.status}`);
  }
  const n64 = rows.filter(r => r.required).length;
  console.log(`\n${rows.length} libraries, ${n64} 64-bit (required), ${failures} failing 64-bit`);
}
process.exit(failures > 0 ? 1 : 0);
