const { useState, useMemo } = React;

function TreeNode({ node, depth, activeId, onSelect, searchQuery }) {
  const [open, setOpen] = useState(node.open !== false);
  const hasChildren = node.children && node.children.length > 0;
  const isActive = activeId === node.id;

  // Filter for search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const matchesSelf = node.title.toLowerCase().includes(q);
    const matchingDescendants = hasChildren
      ? filterNodes(node.children, q)
      : [];
    if (!matchesSelf && matchingDescendants.length === 0) return null;
    node = { ...node, children: matchesSelf ? node.children : matchingDescendants };
  }

  const iconFor = () => {
    if (node.type === "notebook") return <Icons.Notebook size={14} />;
    if (node.type === "section") return <Icons.Folder size={14} />;
    if (node.type === "surah") return <Icons.Book size={14} />;
    if (node.page) return <Icons.Page size={14} />;
    return <Icons.File size={14} />;
  };

  return (
    <div>
      <div
        className="tree-row"
        data-active={isActive}
        style={{ paddingLeft: depth * 12 + 4 }}
        onClick={() => {
          if (node.page) onSelect(node.id);
          else if (hasChildren) setOpen(!open);
        }}
      >
        <div
          className="tree-chevron"
          data-open={open}
          data-empty={!hasChildren}
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        >
          <Icons.Chevron size={11} />
        </div>
        <div className="tree-icon">{iconFor()}</div>
        <div className="tree-label">{node.title}</div>
        {hasChildren && !node.page && (
          <div className="tree-count">{node.children.length}</div>
        )}
        <div
          className="tree-more"
          onClick={(e) => { e.stopPropagation(); }}
          title="More actions"
        >
          <Icons.DotsH size={12} />
        </div>
      </div>
      {hasChildren && open && (
        <div className="tree-children">
          {node.children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              depth={depth + 1}
              activeId={activeId}
              onSelect={onSelect}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function filterNodes(nodes, q) {
  const out = [];
  for (const n of nodes) {
    if (n.title.toLowerCase().includes(q)) {
      out.push(n);
    } else if (n.children) {
      const kids = filterNodes(n.children, q);
      if (kids.length) out.push({ ...n, children: kids, open: true });
    }
  }
  return out;
}

function Sidebar({ activeId, onSelect }) {
  const [query, setQuery] = useState("");

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <button className="ws-switcher" title="Switch workspace">
          <div className="ws-switcher-avatar">TL</div>
          <div className="ws-switcher-name">Tafsir Scholars</div>
          <Icons.ChevronDown size={14} className="ws-switcher-caret" />
        </button>
        <button className="rail-btn" title="New page" style={{ width: 28, height: 28 }}>
          <Icons.Plus size={15} />
        </button>
      </div>

      <div className="sidebar-search">
        <Icons.Search size={14} />
        <input
          placeholder="Search notebooks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="sidebar-search-kbd">⌘K</span>
      </div>

      <div style={{ padding: "4px 10px 0 10px" }}>
        <QuickNav />
      </div>

      <div className="sidebar-section">
        <span>Notebooks</span>
        <button className="sidebar-section-add" title="New notebook">
          <Icons.Plus size={12} />
        </button>
      </div>

      <div className="tree scroll">
        {NOTEBOOK_TREE.map((n) => (
          <TreeNode
            key={n.id}
            node={n}
            depth={0}
            activeId={activeId}
            onSelect={onSelect}
            searchQuery={query}
          />
        ))}
      </div>
    </aside>
  );
}

function QuickNav() {
  const items = [
    { icon: <Icons.Home size={14} />, label: "Home" },
    { icon: <Icons.Inbox size={14} />, label: "Inbox", count: 3 },
    { icon: <Icons.Star size={14} />, label: "Starred" },
    { icon: <Icons.Books size={14} />, label: "Qur'ān library" },
  ];
  return (
    <div>
      {items.map((i) => (
        <div key={i.label} className="tree-row" style={{ paddingLeft: 8 }}>
          <div className="tree-chevron" data-empty="true"><Icons.Chevron size={11} /></div>
          <div className="tree-icon">{i.icon}</div>
          <div className="tree-label">{i.label}</div>
          {i.count != null && <div className="tree-count">{i.count}</div>}
        </div>
      ))}
    </div>
  );
}

// Rail
function Rail({ active, onSelect }) {
  const workspaces = [
    { id: "scholars", label: "TS", title: "Tafsir Scholars" },
    { id: "personal", label: "AB", title: "Personal" },
    { id: "usul",     label: "UF", title: "Uṣūl Circle" },
  ];
  return (
    <div className="rail">
      <div className="rail-logo" title="TafsirLab">T</div>
      <button className="rail-btn" data-active={active === "notes"} onClick={() => onSelect("notes")} title="Notes">
        <Icons.Notebook size={18} />
      </button>
      <button className="rail-btn" title="Qur'ān library">
        <Icons.BookOpen size={18} />
      </button>
      <button className="rail-btn" title="Search">
        <Icons.Search size={18} />
      </button>
      <button className="rail-btn" title="Inbox">
        <Icons.Inbox size={18} />
      </button>

      <div className="rail-spacer" />

      <div className="rail-divider" />
      {workspaces.map((w) => (
        <button
          key={w.id}
          className="rail-ws"
          data-active={w.id === "scholars"}
          title={w.title}
        >
          {w.label}
        </button>
      ))}
      <div className="rail-divider" />
      <button className="rail-btn" title="Settings"><Icons.Settings size={17} /></button>
      <div className="rail-account" title="Signed in via enterprise SSO">AB</div>
    </div>
  );
}

// Alias so Icons.DotsH works
Icons.DotsH = Icons.Dots;

Object.assign(window, { Sidebar, Rail });
