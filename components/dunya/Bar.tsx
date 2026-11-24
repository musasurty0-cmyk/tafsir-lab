/** How a set of papers or booklets stands, as one line: green, amber and red, then what isn't marked. */
export default function Bar({ total, green, amber, red }: { total: number; green: number; amber: number; red: number }) {
  if (!total) return <span className="dn-bar" aria-hidden="true" />;
  return (
    <span className="dn-bar" role="img" aria-label={`${green} confident, ${amber} getting there, ${red} not yet, ${total - green - amber - red} not done`}>
      {([["green", green], ["amber", amber], ["red", red], [undefined, total - green - amber - red]] as const)
        .map(([c, n]) => n > 0 && <i key={c ?? "none"} data-c={c} style={{ flexGrow: n }} />)}
    </span>
  );
}
