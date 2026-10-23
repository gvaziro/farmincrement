/**
 * Save codes: the whole save as one line of text — to move the farm to another
 * browser or keep it somewhere safe. JSON → deflate (where the browser can) →
 * base64url, framed with the save version and a checksum so a cut-off or
 * mistyped code is caught instead of loading half a farm:
 *
 *   TFE<version>.<z|j>.<payload>.<checksum>
 *
 * A plain JSON save (a downloaded file) is accepted by `decodeSave` as well.
 */
import { isFutureSave, type SaveData } from "./save";

const PREFIX = "TFE";

export type DecodeResult = { ok: true; data: SaveData } | { ok: false; error: string };

export async function encodeSave(data: SaveData): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(data));
  const packed = await deflate(raw);
  const body = packed ?? raw;
  return [`${PREFIX}${data.v}`, packed ? "z" : "j", toBase64Url(body), checksum(body)].join(".");
}

export async function decodeSave(text: string): Promise<DecodeResult> {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return checkData(parseJson(trimmed));
  // Codes pasted from chats often get wrapped onto several lines.
  const parts = trimmed.replace(/\s+/g, "").split(".");
  if (!/^TFE\d+$/.test(parts[0])) return { ok: false, error: "Это не код сохранения Tiny Farm Empire" };
  // Starts like a code but the frame is broken: most likely cut off when copying.
  if (parts.length !== 4 || (parts[1] !== "z" && parts[1] !== "j")) return DAMAGED;
  const [, kind, payload, sum] = parts;
  let body: Uint8Array;
  try {
    body = fromBase64Url(payload);
  } catch {
    return DAMAGED;
  }
  if (checksum(body) !== sum) return DAMAGED;
  let bytes: Uint8Array | null = body;
  if (kind === "z") {
    bytes = await inflate(body);
    if (!bytes) return { ok: false, error: "Этот браузер не умеет распаковывать код — попробуй файл" };
  }
  return checkData(parseJson(new TextDecoder().decode(bytes)));
}

const DAMAGED: DecodeResult = { ok: false, error: "Код повреждён — скопируй его целиком" };

function parseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function checkData(data: unknown): DecodeResult {
  if (!data || typeof data !== "object" || typeof (data as { v?: unknown }).v !== "number") return { ok: false, error: "Внутри нет сохранения фермы" };
  if (isFutureSave(data)) return { ok: false, error: "Сохранение из более новой версии игры — обнови страницу" };
  return { ok: true, data: data as SaveData };
}

/** FNV-1a, 32 bits, as 8 hex digits. */
function checksum(bytes: Uint8Array) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function toBase64Url(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("not base64url");
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    return await pipe(bytes, new CompressionStream("deflate-raw"));
  } catch {
    return null;
  }
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    return await pipe(bytes, new DecompressionStream("deflate-raw"));
  } catch {
    return null;
  }
}
