const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { exec } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

const app = express();
const PORT = process.env.PORT || 5003;

app.use(cors());
app.use(express.json());

app.use("/videos", express.static(path.join(__dirname, "public/videos")));

const videosDir = path.join(__dirname, "public/videos");
const clipsDir = path.join(__dirname, "clips");
const tempDir = path.join(__dirname, "temp");

if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
if (!fs.existsSync(clipsDir)) fs.mkdirSync(clipsDir, { recursive: true });
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

console.log(`[FFmpeg] Using bundled binary: ${ffmpegPath}`);

// ── Health ──────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "avatar", ffmpeg: ffmpegPath });
});

// ── Helper: map text tokens → clip file paths ───────────────────
function getClipPaths(text) {
  const tokens = text.trim().toUpperCase().split(/\s+/);
  const paths = [];

  for (const token of tokens) {
    // Try whole-word clip first
    const wordPath = path.join(clipsDir, `${token.toLowerCase()}.webm`);
    if (fs.existsSync(wordPath)) {
      paths.push(wordPath);
    } else {
      // Fall back to letter-by-letter fingerspelling
      for (const char of token) {
        if (/[A-Z]/.test(char)) {
          const charPath = path.join(clipsDir, `${char.toLowerCase()}.webm`);
          if (fs.existsSync(charPath)) {
            paths.push(charPath);
          }
        }
      }
    }
  }
  return paths;
}

// ── POST /generate-sign-video ────────────────────────────────────
app.post("/generate-sign-video", (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text input is required" });
    }

    console.log(`[API] Processing text: "${text}"`);

    const clipPaths = getClipPaths(text);
    if (clipPaths.length === 0) {
      return res.status(404).json({
        error: "No matching clips found for the given text",
        hint: "Ensure .webm clip files exist in the clips/ directory",
      });
    }

    const videoId = uuidv4();
    const listFilename = path.join(tempDir, `${videoId}.txt`);
    const outputFilename = `${videoId}.webm`;
    const outputPath = path.join(videosDir, outputFilename);

    // FFmpeg concat demuxer list — forward slashes required on Windows too
    const listContent = clipPaths
      .map((p) => `file '${p.replace(/\\/g, "/")}'`)
      .join("\n");
    fs.writeFileSync(listFilename, listContent, "utf-8");

    console.log(`[API] Stitching ${clipPaths.length} clip(s)...`);

    // Quote the ffmpegPath to handle spaces in node_modules path on Windows
    const cmd = `"${ffmpegPath}" -y -f concat -safe 0 -i "${listFilename}" -c copy "${outputPath}"`;

    exec(cmd, (error, stdout, stderr) => {
      // Always clean up the temp list file
      try {
        fs.unlinkSync(listFilename);
      } catch (_) {}

      if (error) {
        console.error("[API] FFmpeg error:\n", stderr);
        return res.status(500).json({
          error: "Video stitching failed",
          details: stderr,
        });
      }

      console.log(`[API] Video ready: ${outputPath}`);

      const videoUrl = `${req.protocol}://${req.get("host")}/videos/${outputFilename}`;
      return res.status(200).json({
        status: "success",
        video_url: videoUrl,
        format: "webm",
        clips: clipPaths.length,
      });
    });
  } catch (err) {
    console.error("[API] Server error:", err);
    return res
      .status(500)
      .json({ error: "Server failure", details: err.message });
  }
});

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Avatar service running on port ${PORT}`);
});
