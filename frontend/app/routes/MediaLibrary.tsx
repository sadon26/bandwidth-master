import { useEffect, useState } from "react";
import { listMedia } from "../api";
import MediaCard from "../components/MediaCard";
import UploadForm from "../components/UploadForm";
import RippleIcon from "../assets/ripples.svg";

export default function MediaLibrary() {
  const [list, setList] = useState([]);
  const [view, setView] = useState("grid");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await listMedia();
    setLoading(false);
    setQ("");
    setList(data);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex justify-center w-full">
        <img width={100} src={RippleIcon} alt="ripple-icon" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-3 items-center">
          <h2 className="text-2xl font-bold">Media Library</h2>
          <div className="text-sm text-slate-500">
            Browse and compress your media
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setView("grid")}
            className={`px-3 py-1 rounded ${view === "grid" ? "bg-sky-600 text-white" : "bg-white border"}`}
          >
            Grid
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1 rounded ${view === "list" ? "bg-sky-600 text-white" : "bg-white border"}`}
          >
            List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="mb-4 flex gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="border p-2 rounded flex-1"
            />
            <button
              onClick={load}
              className="px-4 py-2 bg-sky-600 text-white rounded"
            >
              Refresh
            </button>
          </div>

          <div
            className={
              view === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
                : "space-y-3"
            }
          >
            {list
              .filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
              .map((m) => (
                <MediaCard key={m.id} media={m} layout={view} />
              ))}
            {list.length === 0 && (
              <div className="p-6 bg-white rounded shadow text-center">
                No media found — upload files to get started.
              </div>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <div className="mt-4 p-4 bg-white border rounded">
            <div className="font-semibold mb-1">About</div>
            <div className="text-sm text-slate-600">
              Use the Upload form to add media. Use compress to create
              transcodes
            </div>
          </div>
          <UploadForm />
        </aside>
      </div>
    </div>
  );
}
