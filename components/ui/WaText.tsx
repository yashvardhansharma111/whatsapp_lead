// WhatsApp's own markdown, rendered the way WhatsApp renders it.
//
// A template body is written with *bold*, _italic_ and ~strike~ marks, and that is how
// it reaches the customer's phone. The thread showed the raw characters instead, so a
// heading the customer saw in bold read as "*MBBS ADMISSIONS OPEN*" to the agent — the
// same text, formatted two different ways, in the one place they are meant to be
// compared. Plain messages carry the same marks, so both go through here.

/**
 * Escapes first, then marks up: the input is customer text, so nothing in it may reach
 * the DOM as HTML. Returns a string for `dangerouslySetInnerHTML`; prefer `WaText`,
 * which keeps that call in one place.
 */
export function formatWaText(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```([^`]+)```/g, '<code class="rounded bg-black/10 px-1 font-mono text-[0.9em]">$1</code>')
    .replace(/(^|\s)\*([^*\n]+)\*/g, "$1<strong>$2</strong>")
    .replace(/(^|\s)_([^_\n]+)_/g, "$1<em>$2</em>")
    .replace(/(^|\s)~([^~\n]+)~/g, "$1<s>$2</s>")
    .replace(/\n/g, "<br />");
}

export function WaText({ text, className }: { text: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: formatWaText(text) }} />;
}
