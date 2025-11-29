import { useEffect, useState, useRef } from "react";
import { getJobStatus } from "../api";

export default function useJobStatus(jobId, { interval = 1500 } = {}) {
  const [status, setStatus] = useState(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let mounted = true;
    async function poll() {
      try {
        const s = await getJobStatus(jobId);
        if (!mounted) return;
        setStatus(s);
        if (["processing", "uploading to bucket"].includes(s.status)) {
          timer.current = setTimeout(poll, interval);
        }
      } catch (e) {
        console.error("poll error", e);
        timer.current = setTimeout(poll, interval);
      }
    }
    poll();

    return () => {
      mounted = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [jobId, interval]);

  return status;
}
