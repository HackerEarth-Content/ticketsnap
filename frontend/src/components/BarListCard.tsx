import type { BarItem } from "./BarList";
import { BarList } from "./BarList";

interface Props {
  title: string;
  sub: string;
  items: BarItem[];
  loading: boolean;
  emptyLabel: string;
  onItemClick?: (label: string) => void;
  activeLabel?: string | null;
  /** Caps the bar list's height and scrolls internally past it, so a long
   * list (many reporters/product areas) doesn't stretch the card -- and the
   * grid row it shares with a neighboring card -- past a fixed height. */
  maxHeight?: number;
}

export function BarListCard({
  title,
  sub,
  items,
  loading,
  emptyLabel,
  onItemClick,
  activeLabel,
  maxHeight,
}: Props) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">{title}</div>
          <div className="card-sub">{sub}</div>
        </div>
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 90, width: "100%" }} />
      ) : items.length === 0 ? (
        <div className="card-sub">{emptyLabel}</div>
      ) : maxHeight ? (
        <div style={{ maxHeight, overflowY: "auto", paddingRight: 4 }}>
          <BarList items={items} onItemClick={onItemClick} activeLabel={activeLabel} />
        </div>
      ) : (
        <BarList items={items} onItemClick={onItemClick} activeLabel={activeLabel} />
      )}
    </div>
  );
}
