import clsx from "clsx";
import { useNavigate } from "react-router";

export default function MediaCard({ media, layout = "grid" }) {
  const nav = useNavigate();
  const isVideo = media.type === "video";

  return (
    <div
      className={clsx(
        "border rounded-lg p-4 shadow-sm hover:shadow-lg transition",
        layout === "list"
          ? "flex items-center justify-between flex-wrap gap-3"
          : ""
      )}
    >
      <div className={clsx(layout === "list" ? "flex items-center gap-4" : "")}>
        <div
          className={clsx(
            layout === "list" ? "w-28 h-16" : "w-full h-44",
            "bg-black/5 rounded flex items-center justify-center overflow-hidden"
          )}
        >
          {isVideo ? (
            <video
              src={media.url}
              className="w-full h-full object-cover"
              muted
            />
          ) : (
            <div className="text-sm text-slate-500">Audio file</div>
          )}
        </div>

        <div className={clsx(layout === "list" ? "min-w-0" : "mt-3")}>
          <div className="font-semibold truncate max-w-[200px]">
            {media.name}
          </div>
          <div className="text-sm text-slate-500">
            {(media.size / 1024 / 1024).toFixed(2)} MB • {media.type}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-3 sm:mt-0">
        <button
          onClick={() => nav(`/player/${encodeURIComponent(media.name)}`)}
          className="px-3 py-1 bg-white border rounded"
        >
          View
        </button>
        <button
          onClick={() => nav(`/compress/${encodeURIComponent(media.name)}`)}
          className="px-3 py-1 bg-sky-600 text-white rounded"
        >
          Compress
        </button>
      </div>
    </div>
  );
}
