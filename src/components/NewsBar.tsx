import { formatDistanceToNow } from "date-fns";
import type { NewsItem } from "@/lib/types";

interface NewsBarProps {
  items: NewsItem[];
}

export function NewsBar({ items }: NewsBarProps) {
  const message =
    items.length > 0
      ? items.map((n) => n.content).join(" • ")
      : "No news in the last 3 hours.";

  return (
    <div className="flex items-stretch bg-[#0056b3] text-white">
      <span className="flex items-center bg-[#FF007A] px-4 py-2 text-xs font-black uppercase tracking-wider">
        News
      </span>
      <p className="flex flex-1 items-center px-4 py-2 text-sm">{message}</p>
      {items[0] && (
        <span className="hidden items-center px-4 text-xs text-white/70 md:flex">
          {formatDistanceToNow(new Date(items[0].created_at), { addSuffix: true })}
        </span>
      )}
    </div>
  );
}
