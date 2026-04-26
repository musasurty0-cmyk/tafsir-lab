const { useState: useS, useRef, useEffect: useE, useCallback } = React;

// ---- Slash menu items ----
const SLASH_ITEMS = [
  { group: "Basic",
    items: [
      { id: "p",        name: "Text",         desc: "Plain paragraph",            icon: "Text"     },
      { id: "h1",       name: "Heading 1",    desc: "Large section title",        icon: "H1"       },
      { id: "h2",       name: "Heading 2",    desc: "Medium heading",             icon: "H2"       },
      { id: "h3",       name: "Heading 3",    desc: "Small heading",              icon: "H3"       },
      { id: "list",     name: "Bulleted list",desc: "Unordered list",             icon: "List"     },
      { id: "quote",    name: "Quote",        desc: "Blockquote",                 icon: "Quote"    },
      { id: "divider",  name: "Divider",      desc: "Horizontal rule",            icon: "Divider"  },
    ]
  },
  { group: "Research",
    items: [
      { id: "verse",    name: "Verse block",  desc: "Anchor a Qur'ānic āyah",     icon: "Verse"    },
      { id: "callout",  name: "Callout",      desc: "Highlighted note",           icon: "Callout"  },
      { id: "commentary", name: "Commentary", desc: "Cite a classical tafsīr",    icon: "Book"     },
    ]
  },
];

// ---- Blocks ----
function Block({ block, active, onOpenVerse, onHoverVerse, onActivate }) {
  const Row = ({ children }) => (
    <div className="block" data-focused={active}>
      <div className="block-handle">
        <button className="handle-btn" title="Add block"><Icons.Plus size={13} /></button>
        <button className="handle-btn" title="Drag to reorder"><Icons.Grip size={13} /></button>
      </div>
      {children}
    </div>
  );

  // Only apply contentEditable to blocks with plain string text — React 18
  // rejects string-ref-like behavior on contentEditable with nested JSX.
  const CE = (text) => typeof text === "string"
    ? { contentEditable: true, suppressContentEditableWarning: true }
    : {};
  if (block.type === "h1") return <Row><h1 className="block-h1" {...CE(block.text)}>{block.text}</h1></Row>;
  if (block.type === "h2") return <Row><h2 className="block-h2" {...CE(block.text)}>{block.text}</h2></Row>;
  if (block.type === "h3") return <Row><h3 className="block-h3" {...CE(block.text)}>{block.text}</h3></Row>;
  if (block.type === "p")  return <Row><p className="block-p"  {...CE(block.text)}>{block.text}</p></Row>;
  if (block.type === "divider") return <Row><div className="block-divider" /></Row>;
  if (block.type === "quote") return <Row><div className="block-quote" {...CE(block.text)}>{block.text}</div></Row>;
  if (block.type === "list") return (
    <Row>
      <ul className="block-list">
        {block.items.map((it, i) => <li key={i} {...CE(it)}>{it}</li>)}
      </ul>
    </Row>
  );
  if (block.type === "callout") {
    const IconComp = Icons[block.icon] || Icons.Callout;
    return (
      <Row>
        <div className="block-callout">
          <div className="callout-icon"><IconComp size={18} /></div>
          <div className="callout-body" {...CE(block.text)}>{block.text}</div>
        </div>
      </Row>
    );
  }
  if (block.type === "verse") {
    const v = block.verse;
    const ref = `Q 1:${v.n}`;
    return (
      <div
        className="verse-block"
        data-active={active}
        onClick={() => onActivate && onActivate(block.id)}
      >
        <div className="verse-header">
          <div className="verse-ref">
            <span className="verse-ref-dot" />
            <span>{ref} · {block.label || "Verse"}</span>
          </div>
          <div className="verse-actions">
            <button className="verse-action" title="Copy Arabic" onClick={(e) => e.stopPropagation()}>
              <Icons.Copy size={13} />
            </button>
            <button className="verse-action" title="Bookmark" onClick={(e) => e.stopPropagation()}>
              <Icons.Bookmark size={13} />
            </button>
            <button
              className="verse-action"
              data-active={active}
              title="Open tafsīr commentary"
              onClick={(e) => { e.stopPropagation(); onOpenVerse(ref); }}
            >
              <Icons.BookOpen size={13} />
            </button>
          </div>
        </div>
        <div className="verse-arabic">{v.ar}</div>
        <div className="verse-translit">{v.tl}</div>
        <div className="verse-translation">
          <span className="tr-num">{v.n}</span>{v.en}
        </div>
      </div>
    );
  }
  return null;
}

// ---- Editor ----
function Editor({ doc, openVerse, activeVerseRef, activeBlockId, onActivateBlock }) {
  const [slashOpen, setSlashOpen] = useS(false);
  const [slashPos, setSlashPos]   = useS({ top: 0, left: 0 });
  const [slashSel, setSlashSel]   = useS(0);
  const [slashFilter, setSlashFilter] = useS("");

  const [fmtBar, setFmtBar] = useS(null); // {top,left,bold,italic,under}

  const docRef = useRef(null);

  // Slash menu trigger on "/"
  useE(() => {
    const onKey = (e) => {
      const target = e.target;
      if (!(target && target.isContentEditable)) return;
      if (e.key === "/") {
        // open menu near caret
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          const container = docRef.current.getBoundingClientRect();
          setSlashPos({
            top: rect.bottom - container.top + 6,
            left: rect.left - container.left,
          });
          setSlashOpen(true);
          setSlashSel(0);
          setSlashFilter("");
        }
      }
      if (slashOpen) {
        const flat = SLASH_ITEMS.flatMap((g) => g.items).filter(
          (i) => i.name.toLowerCase().includes(slashFilter.toLowerCase())
        );
        if (e.key === "ArrowDown") { e.preventDefault(); setSlashSel((s) => Math.min(s + 1, flat.length - 1)); }
        if (e.key === "ArrowUp")   { e.preventDefault(); setSlashSel((s) => Math.max(s - 1, 0)); }
        if (e.key === "Escape")    { setSlashOpen(false); }
        if (e.key === "Enter")     { e.preventDefault(); setSlashOpen(false); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [slashOpen, slashFilter]);

  // Selection -> floating format bar
  useE(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { setFmtBar(null); return; }
      const node = sel.anchorNode;
      if (!node) { setFmtBar(null); return; }
      const el = node.nodeType === 1 ? node : node.parentElement;
      if (!el || !el.closest(".doc")) { setFmtBar(null); return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width < 2 && rect.height < 2) { setFmtBar(null); return; }
      const container = docRef.current.getBoundingClientRect();
      setFmtBar({
        top: rect.top - container.top - 42,
        left: rect.left - container.left + rect.width / 2 - 130,
        bold:   document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        under:  document.queryCommandState("underline"),
      });
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  const exec = (cmd) => { document.execCommand(cmd, false, null); };

  const filteredSlash = SLASH_ITEMS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.name.toLowerCase().includes(slashFilter.toLowerCase())),
  })).filter((g) => g.items.length);

  return (
    <div className="doc-wrap">
      <div className="doc" ref={docRef}>
        <div className="doc-cover">
          <div className="doc-cover-tag">Quranic Studies · Surah Al-Fatiha · Question 1</div>
          <h1 className="doc-title" contentEditable suppressContentEditableWarning>
            Names of the Surah, and why
          </h1>
          <div className="doc-meta">
            <div className="doc-meta-item">
              <div className="doc-meta-avatar">AB</div>
              <span>Abdullah B.</span>
            </div>
            <span>·</span>
            <div className="doc-meta-item"><Icons.History size={12} /> Edited 2 hours ago</div>
            <span>·</span>
            <div className="doc-meta-item"><Icons.Comment size={12} /> 4 comments</div>
            <span>·</span>
            <div className="doc-meta-item"><Icons.BookOpen size={12} /> 12 min read</div>
          </div>
        </div>

        {doc.map((b) => (
          <Block
            key={b.id}
            block={b}
            active={
              (b.type === "verse" && activeVerseRef === `Q 1:${b.verse.n}`) ||
              activeBlockId === b.id
            }
            onOpenVerse={openVerse}
            onActivate={onActivateBlock}
          />
        ))}

        <button className="add-block">
          <Icons.Plus size={14} />
          <span>Click to add a block, or type <span className="kbd">/</span> for menu</span>
        </button>

        {/* Slash menu */}
        {slashOpen && (
          <div className="slash-menu" style={{ top: slashPos.top, left: slashPos.left }}>
            <div style={{ padding: "4px 8px 6px 8px", borderBottom: "1px solid var(--line)", marginBottom: 4 }}>
              <input
                autoFocus
                placeholder="Filter blocks…"
                value={slashFilter}
                onChange={(e) => { setSlashFilter(e.target.value); setSlashSel(0); }}
                onKeyDown={(e) => e.stopPropagation()}
                style={{ width: "100%", border: 0, background: "transparent", outline: "none", fontSize: 13, padding: "3px 0" }}
              />
            </div>
            {filteredSlash.map((g) => (
              <div key={g.group}>
                <div className="slash-section">{g.group}</div>
                {g.items.map((it, idx) => {
                  const flatIdx = filteredSlash.slice(0, filteredSlash.indexOf(g)).reduce((a, gg) => a + gg.items.length, 0) + idx;
                  const IconC = Icons[it.icon] || Icons.Text;
                  return (
                    <div
                      key={it.id}
                      className="slash-item"
                      data-selected={slashSel === flatIdx}
                      onMouseEnter={() => setSlashSel(flatIdx)}
                      onClick={() => setSlashOpen(false)}
                    >
                      <div className="slash-item-icon"><IconC size={15} /></div>
                      <div className="slash-item-text">
                        <div className="slash-item-name">{it.name}</div>
                        <div className="slash-item-desc">{it.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {filteredSlash.length === 0 && (
              <div style={{ padding: "16px 10px", color: "var(--ink-3)", fontSize: 13, textAlign: "center" }}>
                No blocks match "{slashFilter}"
              </div>
            )}
          </div>
        )}

        {/* Format bar */}
        {fmtBar && (
          <div className="format-bar" style={{ top: fmtBar.top, left: fmtBar.left }}>
            <button className="fb-btn" data-active={fmtBar.bold}   onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}><Icons.Bold size={14} /></button>
            <button className="fb-btn" data-active={fmtBar.italic} onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}><Icons.Italic size={14} /></button>
            <button className="fb-btn" data-active={fmtBar.under}  onMouseDown={(e) => { e.preventDefault(); exec("underline"); }}><Icons.Underline size={14} /></button>
            <button className="fb-btn" onMouseDown={(e) => { e.preventDefault(); exec("strikeThrough"); }}><Icons.Strike size={14} /></button>
            <div className="fb-sep" />
            <button className="fb-btn" onMouseDown={(e) => e.preventDefault()}><Icons.Code size={14} /></button>
            <button className="fb-btn" onMouseDown={(e) => e.preventDefault()}><Icons.Link size={14} /></button>
            <div className="fb-sep" />
            <button className="fb-btn" title="Turn into verse anchor" onMouseDown={(e) => e.preventDefault()}><Icons.Verse size={14} /></button>
            <button className="fb-btn" title="Comment" onMouseDown={(e) => e.preventDefault()}><Icons.Comment size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { Editor });
