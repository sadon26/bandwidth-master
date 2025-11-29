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

// Multer storage for original uploads
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "media",
    resource_type: "auto", // auto detects audio/video/image
  }),
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
   HELPER FUNCTIONS
--------------------------- */
function detectType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if ([".mp4", ".mov", ".mkv", ".webm", ".avi", ".ts"].includes(ext))
    return "video";
  if ([".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a"].includes(ext))
    return "audio";
  return "unknown";
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  const units = ["KB", "MB", "GB"];
  let i = -1;
  do {
    bytes /= 1024;
    i++;
  } while (bytes >= 1024 && i < units.length - 1);
  return bytes.toFixed(2) + " " + units[i];
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
      const file = req.file;
      if (!file) return res.status(400).json({ error: "no file" });

      res.json({
        ok: true,
        name: file.originalname,
        url: file.path, // Cloudinary URL
        size: file.size,
      });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "internal" });
    }
  }
);

/* ---------------------------
   MEDIA LIST / DETAIL
--------------------------- */
app.get("/api/media", async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression('folder="media"') // or public_id starts with media/
      .max_results(500)
      .execute();

    const data = result.resources.map((r) => ({
      id: r.public_id,
      name: r.public_id.split("/").pop(),
      url: r.secure_url,
      size: r.bytes,

      // map to FE expected type
      type:
        r.resource_type === "video"
          ? "video"
          : r.resource_type === "image"
          ? "image"
          : "audio",
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

    const data = {
      id: r.public_id,
      name: r.public_id.split("/").pop(),
      url: r.secure_url,
      size: r.bytes,
      type:
        r.resource_type === "video"
          ? "video"
          : r.resource_type === "image"
          ? "image"
          : "audio",
    };

    res.json({ data });
  } catch (err) {
    console.error("Cloudinary fetch error:", err);
    res.status(500).json({ error: "failed to fetch media" });
  }
});

/**
 * Download file from URL to local temp path
 */
async function downloadFile(url, localPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download file: ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(localPath, buffer);

  const stats = fs.statSync(localPath);
  if (!stats.size) throw new Error("Downloaded file is empty");
  return localPath;
}

/**
 * Transcode and upload to Cloudinary (Render-safe)
 */
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

    // Detect type
    const ext = path.extname(mediaUrl).toLowerCase();
    const isVideo = [".mp4", ".mov", ".mkv", ".webm", ".avi", ".ts"].includes(
      ext
    );
    const outExt = isVideo ? "mp4" : "mp3";

    const inputPath = path.join(tempDir, `${jobId}-input${ext}`);
    const outputPath = path.join(tempDir, `${jobId}-output.${outExt}`);

    // Download file from Cloudinary
    await downloadFile(mediaUrl, inputPath);

    // Init JOB
    JOBS[jobId].startedAt = Date.now();
    JOBS[jobId].status = "processing";
    JOBS[jobId].progress = 0;
    JOBS[jobId].updatedAt = Date.now();
    persistJobs();

    // FFmpeg args
    const videoCodec = !codec || codec === "h264" ? "libx264" : codec;
    let audioBitrate = bitrate || "1200k";
    if (/^\d+$/.test(audioBitrate)) audioBitrate = `${audioBitrate}k`;

    const args = ["-y", "-i", inputPath];
    if (isVideo) {
      if (width) args.push("-vf", `scale=${width}:-2`);
      args.push("-c:v", videoCodec, "-crf", "23", "-preset", "slow");
      args.push("-c:a", "aac", "-b:a", audioBitrate);
    } else {
      args.push("-c:a", "aac", "-b:a", audioBitrate);
    }
    args.push(outputPath);

    // Use system ffmpeg if ffmpeg-static fails on Render
    const ffmpegCmd = "ffmpeg";

    await new Promise((resolve, reject) => {
      const ff = spawn(ffmpegCmd, args, { windowsHide: true });

      ff.stderr.on("data", (data) => {
        const line = data.toString().trim();
        console.log(`[ffmpeg][job ${jobId}]`, line);

        if (line.includes("time=")) {
          JOBS[jobId].progress = Math.min(JOBS[jobId].progress + 3, 99);
          JOBS[jobId].updatedAt = Date.now();
          persistJobs();
        }
      });

      ff.on("error", (err) => reject(err));
      ff.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}`));
      });
    });

    // File sizes
    const inputSize = fs.statSync(inputPath).size;
    const outputSize = fs.statSync(outputPath).size;

    // Upload transcoded file to Cloudinary
    const uploaded = await cloudinary.uploader.upload(outputPath, {
      resource_type: "video", // works for mp4 and mp3
      folder: "media/transcoded",
      public_id: jobId,
      overwrite: true,
    });

    // Update JOBS
    JOBS[jobId].status = "finished";
    JOBS[jobId].progress = 100;
    JOBS[jobId].updatedAt = Date.now();
    JOBS[jobId].outputPath = uploaded.secure_url;
    JOBS[jobId].inputSize = inputSize;
    JOBS[jobId].outputSize = outputSize;
    JOBS[jobId].outputSizeHuman = `${(outputSize / 1024 / 1024).toFixed(2)} MB`;
    JOBS[jobId].compressionRatio = outputSize / inputSize;
    JOBS[jobId].bitrate = bitrate;
    persistJobs();

    // Cleanup
    fs.rmSync(inputPath, { force: true });
    fs.rmSync(outputPath, { force: true });

    console.log(`[transcode][job ${jobId}] completed`);
  } catch (err) {
    console.error(`[transcode error][job ${jobId}]`, err);
    JOBS[jobId].status = "error";
    JOBS[jobId].detail = err.message;
    JOBS[jobId].updatedAt = Date.now();
    persistJobs();
  }
}

/**
 * /api/transcode endpoint
 */
app.post("/api/transcode", async (req, res) => {
  try {
    const { id, codec = "libx264", bitrate = "800k", width } = req.body;
    if (!id) return res.status(400).json({ error: "missing id" });

    // Fetch media info from Cloudinary
    const search = await cloudinary.search
      .expression(`public_id="media/${id}"`)
      .max_results(1)
      .execute();

    if (!search.resources.length) {
      return res.status(400).json({ error: "Invalid media file" });
    }

    const mediaResource = search.resources[0];
    const mediaUrl = mediaResource.secure_url;

    // Create JOB with all fields
    const job = createJob({ input: id, type: "transcode" });
    const jobId = job.jobId;

    JOBS[jobId].outputPath = null; // will be set when done
    JOBS[jobId].status = "processing";
    persistJobs();

    // Fire-and-forget transcoding
    transcodeFile(jobId, mediaUrl, codec, bitrate, width);

    // FE-safe response
    res.json({ jobId, outputUrl: JOBS[jobId].outputPath });
  } catch (e) {
    console.error("/api/transcode error", e);
    return res.status(500).json({ error: "internal" });
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
