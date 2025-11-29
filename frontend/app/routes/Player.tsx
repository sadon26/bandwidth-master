import { useEffect, useState } from "react";
import { BACKEND_URL, getMedia } from "../api";
import { useNavigate, useParams } from "react-router";

export default function Player() {
  const { mediaId } = useParams();
  const [media, setMedia] = useState<any>(null);
  const [netInfo, setNetInfo] = useState<any>(null);
  const [recommendation, setRecommendation] = useState<any>(null);

  const nav = useNavigate();

  /* ------------------------------------------------
     1. Load media file
     ------------------------------------------------ */
  useEffect(() => {
    getMedia(mediaId)
      .then(setMedia)
      .catch(() => setMedia(null));
  }, [mediaId]);

  /* ------------------------------------------------
     2. Detect Network Type & Downlink (Mbps)
     ------------------------------------------------ */
  useEffect(() => {
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (connection) {
      const info = {
        type: connection.effectiveType, // "wifi", "4g", "3g", "slow-2g"
        downlink: connection.downlink, // estimated Mbps
        rtt: connection.rtt,
      };

      setNetInfo(info);
      generateRecommendation(info);
    } else {
      // fallback
      setNetInfo({ type: "unknown", downlink: null });
    }
  }, []);

  /* ------------------------------------------------
     3. Generate Compression Recommendation
     ------------------------------------------------ */
  function generateRecommendation(info: any) {
    if (!info) return;

    let preset = {
      width: 1280,
      bitrate: "1500k",
      reason: "Balanced quality",
    };

    // simple heuristic presets
    if (info.downlink <= 1) {
      preset = {
        width: 480,
        bitrate: "400k",
        reason: "Very low bandwidth → maximize savings",
      };
    } else if (info.downlink <= 3) {
      preset = {
        width: 720,
        bitrate: "800k",
        reason: "Moderate bandwidth → medium compression recommended",
      };
    } else if (info.downlink <= 10) {
      preset = {
        width: 1080,
        bitrate: "1500k",
        reason: "Good bandwidth → standard HD compression",
      };
    } else {
      preset = {
        width: 1920,
        bitrate: "2500k",
        reason: "Excellent bandwidth → high quality output",
      };
    }

    setRecommendation(preset);
  }

  /* ------------------------------------------------
     4. Navigate to compression page with recommendation
     ------------------------------------------------ */
  function applyRecommendation() {
    if (!recommendation) return;

    nav(
      `/compress/${encodeURIComponent(media.id)}?width=${recommendation.width}&bitrate=${recommendation.bitrate}`
    );
  }

  if (!media) return <div className="p-8">Loading...</div>;

  const backend = import.meta.env.VITE_BACKEND_URL || BACKEND_URL;

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold truncate">{media.name}</h2>

        <div className="flex gap-2">
          <button
            className="px-3 py-1 bg-white border rounded"
            onClick={() => nav(-1)}
          >
            Back
          </button>

          <button
            className="px-3 py-1 bg-sky-600 text-white rounded"
            onClick={() => nav(`/compress/${encodeURIComponent(media.id)}`)}
          >
            Compress
          </button>
        </div>
      </div>

      {/* PLAYER */}
      <div className="bg-white rounded shadow p-4">
        {media.type === "video" ? (
          <video
            controls
            className="w-full max-h-[60vh] rounded"
            src={`${backend}${media.url}`}
          />
        ) : (
          <audio controls className="w-full" src={`${backend}${media.url}`} />
        )}

        <div className="mt-4 text-sm text-slate-600 grid grid-cols-2 gap-4">
          <div>Size: {(media.size / 1024 / 1024).toFixed(2)} MB</div>
          <div>Type: {media.type}</div>
        </div>
      </div>

      {/* NETWORK AWARE RECOMMENDATION */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h3 className="font-semibold text-lg mb-2">
          Network-Aware Compression
        </h3>

        {netInfo ? (
          <div className="text-sm text-slate-700">
            <p>
              <strong>Connection:</strong> {netInfo.type.toUpperCase()}{" "}
              {netInfo.downlink ? `(${netInfo.downlink} Mbps)` : ""}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-600">Detecting network...</p>
        )}

        {recommendation && (
          <div className="mt-3 p-3 bg-white rounded shadow">
            <p>
              <strong>Suggested Resolution:</strong> {recommendation.width}p
            </p>
            <p>
              <strong>Suggested Bitrate:</strong> {recommendation.bitrate}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {recommendation.reason}
            </p>

            <button
              onClick={applyRecommendation}
              className="mt-3 px-3 py-1 bg-sky-600 text-white rounded"
            >
              Apply Recommended Compression
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
