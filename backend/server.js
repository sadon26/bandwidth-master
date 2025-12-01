// backend/server.js
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import morgan from "morgan";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import multer from "multer";
import bcrypt from "bcryptjs";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import fetch from "node-fetch";

// --- CONFIGURATION ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory Paths
const MEDIA_DIR = path.join(__dirname, "media");
const TRANSCODE_DIR = path.join(MEDIA_DIR, "transcoded");
const UPLOADS_DIR = path.join(MEDIA_DIR, "uploads");
const PUBLIC_DIR = path.join(__dirname, "public");

// Ensure directories exist
[MEDIA_DIR, TRANSCODE_DIR, UPLOADS_DIR, PUBLIC_DIR].forEach((d) =>
  fs.mkdirSync(d, { recursive: true })
);

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://bandwidth-master-37z1.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(morgan("dev"));

const PORT = process.env.PORT || 3001;
const SECRET = process.env.JWT_SECRET || "bwm-dev-secret";

// --- CLOUDINARY CONFIG ---
cloudinary.config({
  cloud_name: "dtsjiqrgd",
  api_key: 651574195252621,
  api_secret: "zcyxgefeLsgLwDH0g8q4XdY4Rjc",
});

// Helper: detect file type based on extension
function detectType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if ([".mp4", ".mov", ".mkv", ".webm", ".avi", ".ts"].includes(ext))
    return "video";
  if ([".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a"].includes(ext))
    return "audio";
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"].includes(ext))
    return "image";
  return "raw";
}

// --- MULTER STORAGE ---
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    let type = detectType(file.originalname);
    if (type === "audio")
      type = "raw"; // Cloudinary doesn't accept "audio" as resource_type
    else if (type !== "video" && type !== "image") type = "raw";
    return {
      folder: "media",
      resource_type: type,
    };
  },
});

const upload = multer({ storage });

// --- USERS & AUTH ---
const USERS = {
  "demo@bwm.test": {
    passwordHash: bcrypt.hashSync("password", 8),
    name: "Demo",
  },
};

function generateToken(email) {
  return jwt.sign({ email }, SECRET, { expiresIn: "8h" });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "missing auth" });
  try {
    req.user = jwt.verify(auth.replace("Bearer ", ""), SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = USERS[email];
  if (!user || !bcrypt.compareSync(password, user.passwordHash))
    return res.status(401).json({ error: "invalid" });
  res.json({ token: generateToken(email), email });
});

/* ---------------------------
   JOBS STORE
--------------------------- */
let JOBS = {};
const JOBS_FILE = path.join(__dirname, "jobs.json");

function loadJobs() {
  if (fs.existsSync(JOBS_FILE)) {
    try {
      JOBS = JSON.parse(fs.readFileSync(JOBS_FILE, "utf8") || "{}");
    } catch {
      JOBS = {};
    }
  }
}
function persistJobs() {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(JOBS, null, 2));
}
loadJobs();

function createJob({ input, type = "transcode", outputPath = null }) {
  const jobId = uuidv4();
  JOBS[jobId] = {
    jobId,
    input,
    type,
    status: "queued",
    progress: 0,
    outputPath,
    createdAt: Date.now(),
    startedAt: null,
    updatedAt: Date.now(),
    detail: null,
    durationSec: null,
    inputSize: null,
    outputSize: null,
    outputSizeHuman: null,
    compressionRatio: null,
    bitrate: null,
  };
  persistJobs();
  return JOBS[jobId];
}

/* ---------------------------
   UPLOAD ENDPOINT
--------------------------- */
app.post(
  "/api/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const origType = detectType(req.file.originalname);
      const type = origType === "audio" ? "audio" : origType; // FE expects audio/video/image

      res.json({
        ok: true,
        name: req.file.originalname,
        url: req.file.path,
        size: req.file.size,
        resource_type: type,
        type,
      });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message || JSON.stringify(err) });
    }
  }
);

/* ---------------------------
   MEDIA LIST / DETAIL
--------------------------- */
app.get("/api/media", async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression('folder="media"')
      .max_results(500)
      .execute();

    const data = result.resources.map((r) => ({
      id: r.public_id,
      name: r.public_id.split("/").pop(),
      url: r.secure_url,
      size: r.bytes,
      type: ["video", "image", "audio"].includes(r.resource_type)
        ? r.resource_type
        : "raw",
    }));

    res.json({ data });
  } catch (err) {
    console.error("Cloudinary list error:", err);
    res.status(500).json({ error: "failed to list media" });
  }
});

app.get("/api/media/:mediaId", async (req, res) => {
  try {
    const publicId = `media/${req.params.mediaId}`;
    const result = await cloudinary.search
      .expression(`public_id="${publicId}"`)
      .max_results(1)
      .execute();

    if (!result.resources.length)
      return res.status(404).json({ error: "media not found" });

    const r = result.resources[0];
    const type = ["video", "image", "audio"].includes(r.resource_type)
      ? r.resource_type
      : "raw";

    res.json({
      data: {
        id: r.public_id,
        name: r.public_id.split("/").pop(),
        url: r.secure_url,
        size: r.bytes,
        type: type === "raw" ? "audio" : type,
      },
    });
  } catch (err) {
    console.error("Cloudinary fetch error:", err);
    res.status(500).json({ error: "failed to fetch media" });
  }
});

/* ---------------------------
   DOWNLOAD & TRANSCODE
--------------------------- */
async function downloadFile(url, localPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download file: ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(localPath, buffer);

  const stats = fs.statSync(localPath);
  if (!stats.size) throw new Error("Downloaded file is empty");
  return localPath;
}

// Transcode function remains same; ensures audio/video types
export async function transcodeFile(
  jobId,
  mediaUrl,
  codec = "libx264",
  bitrate = "800k",
  width
) {
  try {
    const tempDir = "/tmp";
    fs.mkdirSync(tempDir, { recursive: true });

    const ext = path.extname(mediaUrl).toLowerCase();
    const isVideo = [".mp4", ".mov", ".mkv", ".webm", ".avi", ".ts"].includes(
      ext
    );

    // Video -> mp4, Audio -> m4a (AAC)
    const outExt = isVideo ? "mp4" : "m4a";
    const inputPath = path.join(tempDir, `${jobId}-input${ext}`);
    const outputPath = path.join(tempDir, `${jobId}-output.${outExt}`);

    // Download file locally
    await downloadFile(mediaUrl, inputPath);

    // Initialize job
    JOBS[jobId] = {
      ...JOBS[jobId],
      status: "processing",
      progress: 0,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    persistJobs();

    // Normalize audio bitrate
    let audioBitrate = /^\d+$/.test(bitrate)
      ? `${bitrate}k`
      : bitrate || "1200k";

    // Build FFmpeg args
    const args = ["-y", "-i", inputPath, "-threads", "0"];

    if (isVideo) {
      if (width) args.push("-vf", `scale=${width}:-2`);
      args.push(
        "-c:v",
        codec || "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "24",
        "-c:a",
        "aac",
        "-b:a",
        audioBitrate
      );
    } else {
      // Audio-only transcoding
      args.push("-c:a", "aac", "-b:a", audioBitrate, "-f", "ipod"); // Forces .m4a container
    }

    args.push(outputPath);

    // Run FFmpeg
    await new Promise((resolve, reject) => {
      const ff = spawn("ffmpeg", args);
      ff.stderr.on("data", (data) => {
        const line = data.toString();
        if (line.includes("time=")) {
          JOBS[jobId].progress = Math.min(JOBS[jobId].progress + 5, 99);
          JOBS[jobId].updatedAt = Date.now();
          persistJobs();
        }
      });
      ff.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`FFmpeg exited with code ${code}`))
      );
    });

    const inputSize = fs.statSync(inputPath).size;
    const outputSize = fs.statSync(outputPath).size;

    JOBS[jobId].status = "uploading to bucket";
    persistJobs();

    // Upload to Cloudinary
    const uploaded = await cloudinary.uploader.upload(outputPath, {
      resource_type: isVideo ? "video" : "raw", // Audio → raw
      folder: "media/transcoded",
      public_id: jobId,
      overwrite: true,
    });

    JOBS[jobId] = {
      ...JOBS[jobId],
      status: "finished",
      progress: 100,
      updatedAt: Date.now(),
      outputPath: uploaded.secure_url,
      inputSize,
      outputSize,
      outputSizeHuman: `${(outputSize / 1024 / 1024).toFixed(2)} MB`,
      compressionRatio: outputSize / inputSize,
      bitrate,
    };
    persistJobs();

    fs.rmSync(inputPath, { force: true });
    fs.rmSync(outputPath, { force: true });
  } catch (err) {
    console.error(`[transcode error][${jobId}]`, err);
    JOBS[jobId] = {
      ...JOBS[jobId],
      status: "error",
      detail: err.message,
      updatedAt: Date.now(),
    };
    persistJobs();
  }
}

/* ---------------------------
   TRANSCODE ENDPOINTS
--------------------------- */
app.post("/api/transcode", async (req, res) => {
  try {
    const { id, codec = "libx264", bitrate = "800k", width } = req.body;
    if (!id) return res.status(400).json({ error: "missing id" });

    const search = await cloudinary.search
      .expression(`public_id="media/${id}"`)
      .max_results(1)
      .execute();
    if (!search.resources.length)
      return res.status(400).json({ error: "Invalid media file" });

    const mediaResource = search.resources[0];
    const mediaUrl = mediaResource.secure_url;

    const job = createJob({ input: id });
    const jobId = job.jobId;

    JOBS[jobId].outputPath = null;
    JOBS[jobId].status = "processing";
    persistJobs();

    transcodeFile(jobId, mediaUrl, codec, bitrate, width);

    res.json({ jobId, outputUrl: JOBS[jobId].outputPath });
  } catch (err) {
    console.error("/api/transcode error", err);
    res.status(500).json({ error: "internal" });
  }
});

app.get("/api/transcode/:jobId/status", (req, res) => {
  const job = JOBS[req.params.jobId];
  if (!job) return res.status(404).json({ error: "job not found" });
  res.json(job);
});

app.delete("/api/transcode/:jobId", (req, res) => {
  const jobId = req.params.jobId;
  delete JOBS[jobId];
  persistJobs();
  res.json({ ok: true });
});

/* ---------------------------
   START SERVER
--------------------------- */
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
