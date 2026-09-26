/**
 * Keeps /…/ transcriptions out of `text-transform: uppercase` (labels, tapes): uppercasing turns θ into Θ, ð into Ð,
 * ə into Ə, ʌ into Ʌ — charte §3.2 requires IPA glyphs to stay unambiguous.
 */
export function IpaSafe({ text }: { text: string }) {
  const parts = text.split(/(\/[^/\s][^/]*\/)/)
  if (parts.length === 1) return <>{text}</>
  return <>{parts.map((p, i) => (i % 2 ? <span key={i} className="ipa-keep">{p}</span> : p))}</>
}
