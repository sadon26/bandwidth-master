// Compress.tsx
import { useEffect, useState } from "react";
import { BACKEND_URL, getMedia, startTranscode } from "../api";
import CompressionControls from "../components/CompressionControls";
import useJobStatus from "../hooks/useJobStatus";
import { useParams } from "react-router";
import HLSPlayer from "./HlsPlayer";
import CompressionChart from "~/components/CompressionChart";

export default function Compress() {
  const { mediaId } = useParams();
  const [media, setMedia] = useState(null);
  const [jobId, setJobId] = useState(null);
  const status = useJobStatus(jobId);

  useEffect(() => {
    if (!mediaId) return;
    getMedia(mediaId).then(setMedia).catch(console.error);
  }, [mediaId]);

  async function onStart(opts) {
    console.log(opts);
    try {
      const resp = await startTranscode(opts);
      setJobId(resp.jobId);
    } catch (e) {
      console.error(e);
      alert("Failed to start transcode");
    }
  }

  if (!media) return <div className="p-6">Loading media...</div>;

  const backendUrl = import.meta.env.VITE_BACKEND_URL || BACKEND_URL;

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">Compress: {media.id}</h2>

      <div className="flex flex-col md:flex-row gap-6">
        {/* LEFT COLUMN: Previews and Job Status */}
        <div className="flex-1 space-y-4">
          {/* Original Video */}
          <div className="bg-white p-4 rounded shadow">
            <div className="font-semibold mb-2">Original</div>
            <div className="text-sm text-slate-500 mb-4">
              Size: {(media.size / 1024 / 1024).toFixed(2)} MB
            </div>
            {media.type === "video" ? (
              media?.url?.endsWith(".m3u8") ? (
                <HLSPlayer src={`${backendUrl}${status.outputPath}`} />
              ) : (
                <video
                  src={media?.url}
                  controls
                  className="w-full rounded max-h-96 object-contain"
                />
              )
            ) : (
              <audio
                src={`${backendUrl}${media.url}`}
                controls
                className="w-full"
              />
            )}
          </div>

          {/* Compressed Video */}
          <div className="bg-white p-4 rounded shadow">
            <div className="font-semibold mb-2">Transcoded / Compressed</div>
            {status?.outputPath && status?.status === "finished" ? (
              media.type === "video" ? (
                status?.outputPath?.endsWith(".m3u8") ? (
                  <HLSPlayer src={`${backendUrl}${status.outputPath}`} />
                ) : (
                  <video
                    src={status.outputPath}
                    controls
                    className="w-full rounded max-h-96 object-contain"
                  />
                )
              ) : (
                <audio
                  src={`${backendUrl}${status.outputPath}`}
                  controls
                  className="w-full"
                />
              )
            ) : (
              <div className="text-slate-400 text-sm h-40 flex items-center justify-center">
                {status?.status === "processing"
                  ? `Processing compressed ${media?.type}...`
                  : `No compressed ${media?.type} yet`}
              </div>
            )}
            {status?.status === "finished" && (
              <p className="text-sm text-slate-500 mt-3 text-center">
                Compressed file size:{" "}
                {(status?.outputSize / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Controls */}
        <div className="md:w-80 shrink-0">
          {status?.status === "finished" && (
            <CompressionChart
              originalSize={status?.inputSize}
              compressedSize={status?.outputSize}
              bitrate={status?.bitrate}
            />
          )}
          {/* Job Status */}
          <div className="bg-white p-4 rounded shadow mb-4">
            <div className="font-semibold mb-2">Job Status</div>
            {jobId ? (
              <div className="space-y-2">
                <div>
                  Job: <span className="font-mono text-sm">{jobId}</span>
                </div>
                <div>
                  Status:{" "}
                  <strong className="capitalize">
                    {status?.status || "queued"}
                  </strong>
                </div>
                <div className="w-full bg-slate-100 h-4 rounded overflow-hidden">
                  <div
                    style={{ width: `${status?.progress || 0}%` }}
                    className="h-full bg-sky-600 transition-all"
                  />
                </div>
                {status?.outputPath && status?.status === "finished" && (
                  <div className="text-sm">
                    Output:{" "}
                    <a
                      className="text-sky-600 capitalize"
                      href={`${backendUrl}${status.outputPath}`}
                      target="_blank"
                    >
                      download
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No job started</div>
            )}
          </div>

          <CompressionControls
            media={media}
            mediaId={mediaId}
            onStart={onStart}
          />
        </div>
      </div>
    </div>
  );
}
