import { useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import Header from "~/components/Header";

export default function Upload() {
  const { token } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [msg, setMsg] = useState("");
  const [progress, setProgress] = useState(0);

  function handleFileSelect(f: File | null) {
    setFile(f);
    setMsg("");
    setProgress(0);
  }

  async function doUpload() {
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let fileType: "video" | "audio" | "unknown" = "unknown";

    if (["mp4", "mov", "mkv", "webm", "avi"].includes(ext)) fileType = "video";
    else if (["mp3", "aac", "wav", "flac", "ogg", "m4a"].includes(ext))
      fileType = "audio";

    const fd = new FormData();
    fd.append("file", file);
    fd.append("fileType", fileType); // <-- NEW

    try {
      const res = await axios.post("http://localhost:3001/api/upload", fd, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        onUploadProgress: (e) => {
          if (e.total) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        },
      });

      setMsg(`Uploaded: ${res.data?.name}`);
    } catch (err: any) {
      setMsg("Upload failed: " + err.message);
    }
  }

  return (
    <>
      <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center">
        <div className="mb-10 w-full">
          <Header />
        </div>
        <h1 className="text-4xl font-bold mb-8">Upload Media</h1>

        {/* Drag Area */}
        <div
          className={`w-full max-w-xl p-10 border-2 rounded-2xl transition
            ${dragging ? "border-sky-400 bg-white/10" : "border-white/20 bg-white/5"}
        `}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFileSelect(e.dataTransfer.files?.[0] || null);
          }}
        >
          <div className="text-center">
            <p className="text-lg mb-2 font-semibold">
              Drag & drop a video/audio file here
            </p>
            <p className="text-sm text-white/60 mb-4">or click below</p>

            <label className="cursor-pointer bg-sky-600 hover:bg-sky-500 transition px-5 py-3 rounded-xl inline-block">
              Choose File
              <input
                type="file"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              />
            </label>

            {file && <div className="mt-5 text-sky-300">{file.name}</div>}
          </div>
        </div>

        {/* Upload Button */}
        {file && (
          <button
            onClick={doUpload}
            className="mt-8 bg-green-600 hover:bg-green-500 px-6 py-3 rounded-xl text-white font-semibold"
          >
            Upload File
          </button>
        )}

        {/* Progress Bar */}
        {progress > 0 && progress < 100 && (
          <div className="w-full max-w-xl mt-6">
            <div className="bg-white/20 rounded-full h-3 overflow-hidden">
              <div
                className="bg-sky-500 h-3 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-sm text-white/70 mt-2">
              {progress}%
            </p>
          </div>
        )}

        {/* Message */}
        {msg && <div className="mt-6 text-slate-300 text-center">{msg}</div>}
      </div>
    </>
  );
}
