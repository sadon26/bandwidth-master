import { spawn } from "child_process";
import path from "path";
import fs from "fs";

// ----------------------
// CONFIGURATION
// ----------------------

// Replace with the absolute paths to your executables
const FFPROBE_CMD = "/opt/homebrew/bin/ffprobe";
const FFMPEG_CMD = "/opt/homebrew/bin/ffmpeg";

// Replace with a real media file path
const MEDIA_FILE = path.resolve("./media/276047_tiny.mp4"); // <-- adjust this

if (!fs.existsSync(MEDIA_FILE)) {
  console.error("Media file not found:", MEDIA_FILE);
  process.exit(1);
}

// ----------------------
// HELPER: ffprobe duration
// ----------------------
function probeDurationSec(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      filePath,
    ];
    const ffprobe = spawn(FFPROBE_CMD, args);

    let stdout = "";
    let stderr = "";

    ffprobe.stdout.on("data", (d) => {
      stdout += d.toString();
    });

    ffprobe.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(`ffprobe failed with code ${code}, stderr: ${stderr}`)
        );
      }
      try {
        const info = JSON.parse(stdout);
        const dur = parseFloat(info.format.duration || 0);
        resolve(isNaN(dur) ? null : dur);
      } catch (e) {
        console.error("Failed to parse ffprobe output:", stdout);
        resolve(null);
      }
    });

    ffprobe.on("error", (err) => {
      reject(err);
    });
  });
}

// ----------------------
// TEST: ffmpeg version
// ----------------------
function testFfmpeg() {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_CMD, ["-version"]);

    let output = "";
    proc.stdout.on("data", (d) => (output += d.toString()));
    proc.stderr.on("data", (d) => (output += d.toString()));

    proc.on("close", (code) => {
      if (code !== 0)
        return reject(new Error(`ffmpeg failed with code ${code}`));
      resolve(output.trim());
    });

    proc.on("error", reject);
  });
}

// ----------------------
// RUN TEST
// ----------------------
(async () => {
  try {
    console.log("Testing ffmpeg...");
    const ffmpegVersion = await testFfmpeg();
    console.log("ffmpeg version:\n", ffmpegVersion);

    console.log("\nTesting ffprobe duration...");
    const duration = await probeDurationSec(MEDIA_FILE);
    console.log("Duration (seconds):", duration);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
})();
