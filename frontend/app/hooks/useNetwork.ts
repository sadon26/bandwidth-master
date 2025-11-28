import { useEffect, useState } from "react";

export function useNetwork() {
  const [effectiveType, setEffectiveType] = useState<string | null>(null);
  const [downlink, setDownlink] = useState<number | null>(null);

  useEffect(() => {
    const nav = (navigator as any).connection;
    if (nav) {
      setEffectiveType(nav.effectiveType || null);
      setDownlink(nav.downlink || null);
      const handler = () => {
        setEffectiveType(nav.effectiveType || null);
        setDownlink(nav.downlink || null);
      };
      nav.addEventListener("change", handler);
      return () => nav.removeEventListener("change", handler);
    }
  }, []);

  async function measureSpeed(url = "/ping-1mb.bin") {
    try {
      const start = performance.now();
      const resp = await fetch(url, { cache: "no-store" });
      const blob = await resp.blob();
      const duration = (performance.now() - start) / 1000;
      const bits = blob.size * 8;
      const bps = bits / duration;
      const mbps = bps / (1024 * 1024);
      return { mbps, duration };
    } catch (e) {
      return null;
    }
  }

  return { effectiveType, downlink, measureSpeed };
}
