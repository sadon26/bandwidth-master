// CompressionControls.tsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

const codecOptions = [
  // ------------------ VIDEO CODECS ------------------
  {
    value: "libx264",
    label: "H.264 (libx264) — Best Compatibility",
    types: ["video"],
  },
  {
    value: "libx265",
    label: "H.265 / HEVC (libx265) — Smaller File, Less Compatible",
    types: ["video"],
  },
  {
    value: "libvpx",
    label: "VP8 (libvpx) — Web Compatible",
    types: ["video"],
  },
  {
    value: "libvpx-vp9",
    label: "VP9 (libvpx-vp9) — High Compression",
    types: ["video"],
  },
  {
    value: "libaom-av1",
    label: "AV1 (libaom-av1) — Next-Gen (Slow)",
    types: ["video"],
  },

  // ------------------ AUDIO CODECS ------------------
  {
    value: "aac",
    label: "AAC — Recommended for Audio/Video",
    types: ["audio", "video"], // can encode audio in video or standalone audio
  },
  {
    value: "libmp3lame",
    label: "MP3 (libmp3lame)",
    types: ["audio"],
  },
  {
    value: "libopus",
    label: "Opus (libopus)",
    types: ["audio", "video"], // Opus works in audio-only and video containers (WebM)
  },
  {
    value: "flac",
    label: "FLAC — Lossless",
    types: ["audio"],
  },
];

const map = { "1080p": 1920, "720p": 1280, "480p": 854, "360p": 640 };

export default function CompressionControls({
  media,
  mediaId,
  onStart,
  status,
}) {
  const [codec, setCodec] = useState("libx264");
  const [resolution, setResolution] = useState(1280);
  const [bitrate, setBitrate] = useState(1200);
  const [params] = useSearchParams();

  useEffect(() => {
    const paramsWidth = params?.get("width");
    const paramsBitrate = params.get("bitrate");
    if (paramsBitrate) {
      setBitrate(Number(paramsBitrate?.slice(0, -1)));
    }

    if (paramsWidth) {
      setResolution(map[paramsWidth ? `${paramsWidth}p` : resolution] || "");
    }
  }, []);

  function start() {
    onStart({
      id: mediaId,
      codec,
      bitrate: `${bitrate}k`,
      width: resolution || undefined,
    });
  }

  return (
    <div className="border rounded p-4 bg-white space-y-4">
      <div>
        <label className="font-semibold block mb-1">Codec</label>
        <select
          className="w-full border p-2 rounded text-sm"
          value={codec}
          onChange={(e) => setCodec(e.target.value)}
        >
          {codecOptions.map(
            ({ label, value, types }) =>
              types.includes(media.type) && (
                <option key={value} value={value}>
                  {label}
                </option>
              )
          )}
        </select>
      </div>

      {media.type === "video" && (
        <div>
          <label className="font-semibold block mb-1">Resolution</label>
          <select
            className="w-full border p-2 rounded text-sm"
            value={resolution}
            onChange={(e) => setResolution(Number(e.target.value))}
          >
            {Object.entries(map).map(([label, value]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="font-semibold block mb-1">
          Bitrate (kbps): {bitrate}
        </label>
        <input
          type="range"
          min="300"
          max="6000"
          step="100"
          className="w-full"
          value={bitrate}
          onChange={(e) => setBitrate(Number(e.target.value))}
        />
      </div>

      <div className="flex gap-2">
        <button
          className="px-4 py-2 bg-white border rounded"
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href);
            alert("Page link copied to clipboard!");
          }}
        >
          Share
        </button>
        {!["processing", "uploading to bucket"].includes(status) && (
          <button
            className="px-4 py-2 bg-sky-600 text-white rounded"
            onClick={start}
          >
            Start Compression
          </button>
        )}
      </div>
    </div>
  );
}
