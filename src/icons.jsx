// Minimal, consistent stroke icons (1.5px, lucide-ish but hand-authored)
const Icon = ({ d, size = 16, fill = "none", stroke = "currentColor", sw = 1.5, children, style, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={stroke}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
    {...rest}
  >
    {d ? <path d={d} /> : children}
  </svg>
);

const Icons = {
  Search:    (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Icon>,
  Plus:      (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  Chevron:   (p) => <Icon {...p}><path d="m9 6 6 6-6 6"/></Icon>,
  ChevronDown:(p)=> <Icon {...p}><path d="m6 9 6 6 6-6"/></Icon>,
  Notebook:  (p) => <Icon {...p}><path d="M5 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5z"/><path d="M9 3v18"/><path d="M5 8h4M5 12h4M5 16h4"/></Icon>,
  Folder:    (p) => <Icon {...p}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></Icon>,
  File:      (p) => <Icon {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></Icon>,
  Page:      (p) => <Icon {...p}><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 12h8M8 16h5"/></Icon>,
  Hash:      (p) => <Icon {...p}><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></Icon>,
  Home:      (p) => <Icon {...p}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/></Icon>,
  Books:     (p) => <Icon {...p}><path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l4 1-3 14-4-1z"/></Icon>,
  Inbox:     (p) => <Icon {...p}><path d="M3 13h5l1 2h6l1-2h5"/><path d="M5 5h14l2 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z"/></Icon>,
  Star:      (p) => <Icon {...p}><path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z"/></Icon>,
  Settings:  (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Icon>,
  Share:     (p) => <Icon {...p}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/></Icon>,
  Comment:   (p) => <Icon {...p}><path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.4 3.5A8 8 0 0 1 21 12z"/></Icon>,
  Dots:      (p) => <Icon {...p}><circle cx="5" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.1" fill="currentColor" stroke="none"/></Icon>,
  DotsV:     (p) => <Icon {...p}><circle cx="12" cy="5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.1" fill="currentColor" stroke="none"/></Icon>,
  Grip:      (p) => <Icon {...p} sw={1}><circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none"/></Icon>,
  Text:      (p) => <Icon {...p}><path d="M5 5h14M12 5v14M8 19h8"/></Icon>,
  H1:        (p) => <Icon {...p}><path d="M5 5v14M13 5v14M5 12h8M17 9l2-1v11"/></Icon>,
  H2:        (p) => <Icon {...p}><path d="M5 5v14M13 5v14M5 12h8M16 9a2 2 0 0 1 4 0c0 2-4 3-4 6h4"/></Icon>,
  H3:        (p) => <Icon {...p}><path d="M5 5v14M13 5v14M5 12h8M16 9a2 2 0 1 1 2 3 2 2 0 1 1-2 3"/></Icon>,
  Quote:     (p) => <Icon {...p}><path d="M7 7c-2 1-3 3-3 6h3v4H3v-4c0-3 1-5 4-6zM17 7c-2 1-3 3-3 6h3v4h-4v-4c0-3 1-5 4-6z"/></Icon>,
  List:      (p) => <Icon {...p}><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></Icon>,
  NumList:   (p) => <Icon {...p}><path d="M10 6h11M10 12h11M10 18h11"/><path d="M3 5h1.5v4M3 9h3"/><path d="M3 12h3l-3 3h3"/><path d="M3 18h2a1 1 0 0 1 0 2H3"/></Icon>,
  Divider:   (p) => <Icon {...p}><path d="M4 12h16"/></Icon>,
  Callout:   (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></Icon>,
  Verse:     (p) => <Icon {...p}><path d="M4 5h5v5H4zM15 5h5v5h-5zM4 14h16v5H4z"/></Icon>,
  Bold:      (p) => <Icon {...p} sw={2}><path d="M7 5h6a3 3 0 0 1 0 6H7zM7 11h7a3 3 0 0 1 0 6H7z"/></Icon>,
  Italic:    (p) => <Icon {...p}><path d="M14 5h-4M14 19h-4M15 5l-6 14"/></Icon>,
  Underline: (p) => <Icon {...p}><path d="M7 5v7a5 5 0 0 0 10 0V5M5 20h14"/></Icon>,
  Strike:    (p) => <Icon {...p}><path d="M4 12h16"/><path d="M16 7a4 4 0 0 0-4-2c-3 0-5 2-5 4 0 5 10 3 10 7 0 2-2 4-5 4a4 4 0 0 1-4-2"/></Icon>,
  Code:      (p) => <Icon {...p}><path d="m9 8-4 4 4 4M15 8l4 4-4 4"/></Icon>,
  Link:      (p) => <Icon {...p}><path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1.2-1.2"/></Icon>,
  Moon:      (p) => <Icon {...p}><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></Icon>,
  Sun:       (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></Icon>,
  Sliders:   (p) => <Icon {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8M4 12h7M15 12h5"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/><circle cx="13" cy="12" r="2"/></Icon>,
  Close:     (p) => <Icon {...p}><path d="m6 6 12 12M18 6 6 18"/></Icon>,
  Expand:    (p) => <Icon {...p}><path d="M4 14v6h6M20 10V4h-6M20 4l-7 7M4 20l7-7"/></Icon>,
  Sidebar:   (p) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></Icon>,
  Book:      (p) => <Icon {...p}><path d="M4 4h10a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 4v13a3 3 0 0 1 3-3h10"/></Icon>,
  BookOpen:  (p) => <Icon {...p}><path d="M2 5h7a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v11a2 2 0 0 1 2-2h8z"/></Icon>,
  Play:      (p) => <Icon {...p} fill="currentColor"><path d="M7 4v16l13-8z"/></Icon>,
  Bookmark:  (p) => <Icon {...p}><path d="M6 3h12v18l-6-4-6 4z"/></Icon>,
  Copy:      (p) => <Icon {...p}><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/></Icon>,
  History:   (p) => <Icon {...p}><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></Icon>,
  Question:  (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M10 9a2 2 0 1 1 3 2c-1 .5-1 1-1 2M12 17h.01"/></Icon>,
  Sparkle:   (p) => <Icon {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></Icon>,
  Lang:      (p) => <Icon {...p}><path d="M4 7h10M9 4v3M7 20l4-10 4 10M8.5 17h5M13 14h7M16.5 11v3M14.5 20l4-6"/></Icon>,
};

Object.assign(window, { Icon, Icons });
