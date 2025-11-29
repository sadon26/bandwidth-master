import axios from "axios";

const BACKEND = "https://bandwidth-master-5.onrender.com";

export const api = axios.create({
  baseURL: BACKEND,
  headers: {
    "Content-Type": "application/json",
  },
});

export async function listMedia() {
  const res = await api.get("/api/media");
  return res.data?.data || [];
}

export async function getMedia(mediaId) {
  const res = await api.get(`/api/media/${mediaId}`);
  return res.data?.data;
}

export async function uploadFile(formData, token) {
  return api.post("/api/upload", formData, {
    headers: {
      Authorization: `Bearer ${token || ""}`,
      "Content-Type": "multipart/form-data",
    },
  });
}

export async function startTranscode(opts) {
  const res = await api.post("/api/transcode", opts);
  return res.data;
}

export async function getJobStatus(jobId) {
  const res = await api.get(`/api/transcode/${jobId}/status`);
  return res.data;
}
