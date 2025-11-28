import { useEffect, useRef } from "react";
import Hls from "hls.js";

export default function HLSPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    // If the browser supports HLS natively (Safari)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else if (Hls.isSupported()) {
      // Use hls.js for Chrome, Firefox, Edge, etc.
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      return () => {
        hls.destroy();
      };
    }
  }, [src]);

  return (
    <video
      ref={videoRef}
      controls
      className="w-full rounded-xl shadow-lg bg-black"
    />
  );
}
