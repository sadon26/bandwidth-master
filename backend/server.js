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
// import { createRequestHandler } from "@react-router/express";
// import * as build from "../frontend/build/server/index.js";

// --- CONFIGURATION ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const allowedOrigins = [
  "http://localhost:5173", // local dev frontend
  "https://bandwidth-master-37z1.vercel.app", // production frontend
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS: " + origin));
      }
    },
    credentials: true,
  })
);
// app.use(
//   express.static(path.join(__dirname, "../frontend/build/client"), {
//     index: false,
//   })
// );

app.use(express.json());
app.use(morgan("dev"));

const PORT = process.env.PORT || 3001;
const SECRET = process.env.JWT_SECRET || "bwm-dev-secret";

// Directory Paths
const MEDIA_DIR = path.join(__dirname, "media");
const TRANSCODE_DIR = path.join(MEDIA_DIR, "transcoded");
const UPLOADS_DIR = path.join(MEDIA_DIR, "uploads");
const PUBLIC_DIR = path.join(__dirname, "public");
const JOBS_FILE = path.join(__dirname, "jobs.json");

// Ensure directories exist
[MEDIA_DIR, TRANSCODE_DIR, UPLOADS_DIR, PUBLIC_DIR].forEach((d) =>
  fs.mkdirSync(d, { recursive: true })
);

/* ---------------------------
   JOB STORE
--------------------------- */
let JOBS = {};
function loadJobs() {
  if (fs.existsSync(JOBS_FILE)) {
    try {
      JOBS = JSON.parse(fs.readFileSync(JOBS_FILE, "utf8") || "{}");
    } catch (e) {
      console.error("Failed to load jobs.json", e);
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
  };
  persistJobs();
  return JOBS[jobId];
}

/* ---------------------------
   STATIC SERVING
--------------------------- */
app.use("/media", express.static(MEDIA_DIR));
app.use("/media/transcoded", express.static(TRANSCODE_DIR));
app.use("/ping-1mb.bin", express.static(path.join(PUBLIC_DIR, "ping-1mb.bin")));

/* ---------------------------
   SIMPLE MEDIA LIST
--------------------------- */
function detectType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if ([".mp4", ".mov", ".mkv", ".webm", ".avi", ".ts"].includes(ext))
    return "video";
  if ([".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a"].includes(ext))
    return "audio";
  return "unknown";
}

function listMedia() {
  return fs.existsSync(MEDIA_DIR)
    ? fs
        .readdirSync(MEDIA_DIR)
        .filter(
          (f) =>
            fs.statSync(path.join(MEDIA_DIR, f)).isFile() && !f.startsWith(".")
        )
        .map((f) => {
          const stats = fs.statSync(path.join(MEDIA_DIR, f));
          return {
            id: f,
            name: f,
            url: `/media/${f}`,
            size: stats.size,
            type: detectType(f),
          };
        })
    : [];
}

app.get("/api/media", (req, res) => res.json({ data: listMedia() }));
app.get("/api/media/:mediaId", (req, res) => {
  const media = listMedia().find((m) => m.id === req.params.mediaId);
  if (!media) return res.status(404).json({ error: "media not found" });
  res.json({ data: media });
});

/* ---------------------------
   TRANSCODE WITH ffmpeg-static + execa
--------------------------- */

async function transcodeFile(jobId, inputPath, outPath, codec, bitrate, width) {
  JOBS[jobId].startedAt = Date.now();
  JOBS[jobId].status = "processing";
  JOBS[jobId].progress = 0;
  persistJobs();

  const videoCodec =
    !codec || codec === "h264" || codec === "video/h264" ? "libx264" : codec;

  let audioBitrate = bitrate || "1200k";
  if (/^\d+$/.test(audioBitrate)) audioBitrate = `${audioBitrate}k`;

  const args = ["-y", "-i", inputPath];
  if (width) args.push("-vf", `scale=${width}:-2`);

  args.push(
    "-c:v",
    videoCodec,
    "-crf",
    "23",
    "-preset",
    "slow",
    "-c:a",
    "aac",
    "-b:a",
    audioBitrate,
    outPath
  );

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

  const runFfmpeg = () =>
    new Promise((resolve, reject) => {
      const ff = spawn(ffmpegPath, args, { windowsHide: true });

      ff.stderr.on("data", (data) => {
        const line = data.toString().trim();
        console.log(`[ffmpeg stderr][job ${jobId}]:`, line);

        const match = line.match(/time=\s*([\d:.]+)/);
        if (match) {
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

  try {
    await runFfmpeg();

    // --- NEW: get file sizes ---
    const inputSize = fs.statSync(inputPath).size;
    const outputSize = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;

    JOBS[jobId].status = "finished";
    JOBS[jobId].progress = 100;
    JOBS[jobId].updatedAt = Date.now();
    JOBS[jobId].inputSize = inputSize;
    JOBS[jobId].outputSize = outputSize;
    JOBS[jobId].outputSizeHuman = formatBytes(outputSize);
    JOBS[jobId].compressionRatio = outputSize / inputSize;
    JOBS[jobId].bitrate = bitrate;
    persistJobs();

    console.log(`[ffmpeg end][job ${jobId}]: completed`);
  } catch (err) {
    console.error(`[ffmpeg error][job ${jobId}]:`, err);

    JOBS[jobId].status = "error";
    JOBS[jobId].detail = err.message;
    JOBS[jobId].updatedAt = Date.now();
    persistJobs();
  }
}

app.post("/api/transcode", async (req, res) => {
  try {
    const { id, codec = "libx264", bitrate = "800k", width } = req.body;
    console.log("req.body", req.body);

    if (!id) return res.status(400).json({ error: "missing id" });

    const inputPath = path.join(MEDIA_DIR, id);
    console.log("inputPath", inputPath);
    if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile())
      return res.status(400).json({ error: "Invalid media file" });

    const job = createJob({ input: id, type: "transcode" });
    console.log("created job", job);
    const jobId = job.jobId;

    const outPath = path.join(TRANSCODE_DIR, `${jobId}.mp4`);
    console.log("outPath", outPath);
    JOBS[jobId].outputPath = `/media/transcoded/${jobId}.mp4`;
    JOBS[jobId].status = "processing";
    console.log("JOBS[jobId]", JOBS[jobId]);
    persistJobs();

    // Fire and forget transcoding
    transcodeFile(jobId, inputPath, outPath, codec, bitrate, width);

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
  const job = JOBS[jobId];
  if (
    job &&
    job.outputPath &&
    fs.existsSync(path.join(__dirname, job.outputPath))
  ) {
    fs.rmSync(path.join(__dirname, job.outputPath), {
      force: true,
      recursive: true,
    });
  }
  delete JOBS[jobId];
  persistJobs();
  res.json({ ok: true });
});

/* ---------------------------
   AUTH + UPLOAD
--------------------------- */
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

const upload = multer({ dest: UPLOADS_DIR });

app.post("/api/upload", authMiddleware, upload.single("file"), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "no file" });
  const dest = path.join(MEDIA_DIR, file.originalname);
  fs.renameSync(file.path, dest);
  const stats = fs.statSync(dest);
  res.json({
    ok: true,
    name: file.originalname,
    url: `/media/${file.originalname}`,
    size: stats.size,
  });
});

// export default async function handler(req, res) {
//   // Serve API endpoints
//   if (req.url.startsWith("/api")) {
//     if (req.url === "/api/test") {
//       res.status(200).json({ message: "API works!" });
//       return;
//     }
//     res.status(404).json({ message: "Not found" });
//     return;
//   }

//   // Serve SSR frontend
//   const requestHandler = createRequestHandler({ build });
//   return requestHandler(req, res);
// }

/* ---------------------------
   START SERVER
--------------------------- */
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
