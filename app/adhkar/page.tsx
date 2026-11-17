/**
 * /adhkar: the morning and evening adhkār (Ḥiṣn al-Muslim), public, no sign-in.
 * Everything is in lib/adhkar.ts and the page is a client component, because
 * which list opens and how far you have got both depend on the reader's own
 * clock and device.
 */
import AdhkarApp from "@/components/adhkar/AdhkarApp";

export default function AdhkarPage() {
  return <AdhkarApp />;
}
