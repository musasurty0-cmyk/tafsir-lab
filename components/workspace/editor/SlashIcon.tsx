/**
 * The slash menu's icons: the app's own line icons rather than emoji, which
 * drew in each platform's colour set and read as decoration. Keyed by command
 * id; every tafsīr shortcut shares the book. An id with no icon here falls
 * back to the command's text glyph, so a new command still shows something.
 */
import {
  BookOpen, BookOpenText, CircleHelp, Code, Heading1, Heading2, Heading3, Link2,
  List, ListChecks, ListCollapse, ListOrdered, Quote, SeparatorHorizontal, Table,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  help: CircleHelp, link: Link2, ayah: BookOpen, tafsir: BookOpenText,
  h1: Heading1, h2: Heading2, h3: Heading3, quote: Quote,
  bullet: List, numbered: ListOrdered, task: ListChecks, code: Code,
  toggle: ListCollapse, table: Table, divider: SeparatorHorizontal,
};

export default function SlashIcon({ id, isTafsir, fallback, size = 15 }: { id: string; isTafsir?: boolean; fallback: string; size?: number }) {
  const Icon = ICONS[id] ?? (isTafsir ? BookOpenText : null);
  return Icon ? <Icon size={size} strokeWidth={1.9} aria-hidden /> : <>{fallback}</>;
}
