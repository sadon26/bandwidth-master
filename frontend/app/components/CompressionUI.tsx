import { useState, useEffect, type FC } from "react";
import {
  PlayIcon,
  ArrowsRightLeftIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/solid";
import axios from "axios";

type Props = {
  mediaId: string | undefined;
};

const CompressionUI: FC<Props> = ({ mediaId }) => {
  const [media, setMedia] = useState(null);

  // Compression form state
  const [codec, setCodec] = useState("h264");
  const [resolution, setResolution] = useState("1080p");
  const [bitrate, setBitrate] = useState(3500);
  const [estimatedSize, setEstimatedSize] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch media info
  useEffect(() => {
    axios.get(`/api/media/${mediaId}`).then((res) => setMedia(res.data.data));
  }, [mediaId]);

  // Estimate output size
  useEffect(() => {
    if (!media) return;
    const durationSec = media.duration || 120; // fallback 2 mins
    const bytesPerSecond = (bitrate * 1000) / 8;
    const newSizeBytes = durationSec * bytesPerSecond;
    setEstimatedSize((newSizeBytes / 1024 / 1024).toFixed(2));
  }, [bitrate, media]);

  const handleStartCompression = async () => {
    setLoading(true);
    try {
      await axios.post("/api/transcode", {
        id: mediaId,
        codec,
        resolution,
        bitrate,
      });
      alert("Compression started!");
    } catch (e) {
      console.error(e);
      alert("Error starting compression");
    } finally {
      setLoading(false);
    }
  };

  if (!media) return <div className="p-6">Loading media...</div>;

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Compression Settings</h1>

      {/* PREVIEW SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PreviewCard
          title="Original"
          src={`${window?.location.origin}${media.url}`}
          color="border-slate-300"
        />
        <PreviewCard
          title="Compressed Preview"
          src={null}
          color="border-sky-400"
          badge="Pending"
        />
      </div>

      {/* SETTINGS PANEL */}
      <div className="border rounded-lg p-6 shadow-sm bg-white space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <AdjustmentsHorizontalIcon className="w-6 text-sky-600" />
          Compression Settings
        </h2>

        {/* Codec */}
        <div>
          <label className="font-medium">Codec</label>
          <select
            value={codec}
            onChange={(e) => setCodec(e.target.value)}
            className="w-full mt-1 border p-2 rounded"
          >
            <option value="h264">H.264 (MP4)</option>
            <option value="h265">H.265 (HEVC)</option>
            <option value="vp9">VP9 (WebM)</option>
            <option value="av1">AV1</option>
          </select>
        </div>

        {/* Resolution */}
        <div>
          <label className="font-medium">Resolution</label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="w-full mt-1 border p-2 rounded"
          >
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
            <option value="360p">360p</option>
          </select>
        </div>

        {/* Bitrate Slider */}
        <div>
          <label className="font-medium">Bitrate (kbps): {bitrate}</label>
          <input
            type="range"
            min={500}
            max={6000}
            step={100}
            value={bitrate}
            onChange={(e) => setBitrate(parseInt(e.target.value))}
            className="w-full accent-sky-600"
          />
        </div>

        {/* Estimated Size */}
        <div className="p-3 bg-slate-100 rounded-lg">
          <div className="font-semibold">Estimated Output Size</div>
          <div className="text-xl font-bold text-sky-600">
            {estimatedSize} MB
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            className="px-4 py-2 bg-white border rounded flex items-center gap-2"
            onClick={() => alert("Preview not implemented")}
          >
            <PlayIcon className="w-4" />
            Preview Compression
          </button>

          <button
            className="px-4 py-2 bg-sky-600 text-white rounded flex items-center gap-2"
            onClick={handleStartCompression}
            disabled={loading}
          >
            <ArrowsRightLeftIcon className="w-5" />
            {loading ? "Starting..." : "Start Compression"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*                          PREVIEW CARD                              */
/* ------------------------------------------------------------------ */

function PreviewCard({ title, src, color, badge }) {
  return (
    <div className={`border ${color} rounded-lg p-4 shadow-sm relative`}>
      {badge && (
        <span className="absolute top-2 right-2 bg-sky-600 text-white text-xs px-2 py-1 rounded">
          {badge}
        </span>
      )}

      <h3 className="font-semibold mb-2">{title}</h3>

      <div className="w-full h-52 bg-black/10 rounded flex items-center justify-center overflow-hidden">
        {src ? (
          <video src={src} controls className="w-full h-full object-cover" />
        ) : (
          <div className="text-slate-400 text-sm">No preview yet</div>
        )}
      </div>
    </div>
  );
}

export default CompressionUI;
