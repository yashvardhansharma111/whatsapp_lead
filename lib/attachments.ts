// Inbox attachments — shared config & validation.
// Single source of truth for what the composer may attach: categories,
// extensions, MIME types and size caps. Isomorphic — no Node or DOM imports —
// so the same rules run in the composer and on the upload route.

export type AttachmentCategory = "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";

export interface AttachmentSpec {
  category: AttachmentCategory;
  messageType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  label: string;
  maxBytes: number;
  extensions: string[];
  mimeTypes: string[];
  mimePrefix?: string;
}

const MB = 1024 * 1024;

export const ATTACHMENT_SPECS: AttachmentSpec[] = [
  {
    category: "IMAGE",
    messageType: "IMAGE",
    label: "Images",
    maxBytes: 5 * MB,
    extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
    mimeTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ],
    mimePrefix: "image/",
  },
  {
    category: "VIDEO",
    messageType: "VIDEO",
    label: "Videos",
    maxBytes: 16 * MB,
    extensions: ["mp4", "mov", "avi", "mkv", "webm"],
    mimeTypes: [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
      "video/webm",
    ],
    mimePrefix: "video/",
  },
  {
    category: "AUDIO",
    messageType: "AUDIO",
    label: "Audio",
    maxBytes: 16 * MB,
    extensions: ["mp3", "wav", "aac", "ogg"],
    mimeTypes: [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/wave",
      "audio/aac",
      "audio/x-aac",
      "audio/ogg",
    ],
    mimePrefix: "audio/",
  },
  {
    category: "DOCUMENT",
    messageType: "DOCUMENT",
    label: "Documents",
    maxBytes: 16 * MB,
    extensions: [
      "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
      "txt", "csv", "zip", "rar",
    ],
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/zip",
      "application/x-zip-compressed",
      "application/vnd.rar",
      "application/x-rar-compressed",
      "application/octet-stream",
    ],
  },
];

export const MAX_ATTACHMENTS = 10;

const GENERIC_MIME = new Set(["", "application/octet-stream", "application/binary"]);

const SPEC_BY_EXTENSION: Record<string, AttachmentSpec> = {};
for (const spec of ATTACHMENT_SPECS) {
  for (const ext of spec.extensions) SPEC_BY_EXTENSION[ext] = spec;
}

export const ATTACHMENT_ACCEPT = ATTACHMENT_SPECS.flatMap((spec) => [
  ...spec.extensions.map((ext) => `.${ext}`),
  ...(spec.mimePrefix ? [`${spec.mimePrefix}*`] : spec.mimeTypes),
]).join(",");

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function specForFile(file: { name: string }): AttachmentSpec | null {
  return SPEC_BY_EXTENSION[fileExtension(file.name)] ?? null;
}

export interface AttachmentValidation {
  ok: boolean;
  error?: string;
  spec?: AttachmentSpec;
}

export function validateFile(file: { name: string; type: string; size: number }): AttachmentValidation {
  const spec = specForFile(file);
  if (!spec) {
    const ext = fileExtension(file.name);
    return {
      ok: false,
      error: ext
        ? `.${ext} files aren't supported`
        : `"${file.name}" has no file extension`,
    };
  }

  if (file.size <= 0) {
    return { ok: false, error: `"${file.name}" is empty`, spec };
  }

  if (file.size > spec.maxBytes) {
    return {
      ok: false,
      error: `"${file.name}" is larger than the ${formatBytes(spec.maxBytes)} limit for ${spec.label.toLowerCase()}`,
      spec,
    };
  }

  const mime = file.type.toLowerCase();
  if (!GENERIC_MIME.has(mime) && !spec.mimeTypes.includes(mime)) {
    const prefixMismatch = spec.mimePrefix ? !mime.startsWith(spec.mimePrefix) : true;
    if (prefixMismatch) {
      return {
        ok: false,
        error: `"${file.name}" doesn't look like a valid ${spec.category.toLowerCase()} file`,
        spec,
      };
    }
  }

  return { ok: true, spec };
}

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", mp4: "video/mp4",
  mov: "video/quicktime", avi: "video/x-msvideo", mkv: "video/x-matroska",
  webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav", aac: "audio/aac",
  ogg: "audio/ogg", pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv", zip: "application/zip",
  rar: "application/vnd.rar",
};

export function contentTypeForExtension(ext: string): string {
  return CONTENT_TYPE_BY_EXTENSION[ext.toLowerCase()] ?? "application/octet-stream";
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
