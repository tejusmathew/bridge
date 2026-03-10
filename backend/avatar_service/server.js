const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5003;

app.use(cors());
app.use(express.json());

// Serve the built React app in production, or test files
app.use(express.static(path.join(__dirname, 'build')));
app.use('/videos', express.static(path.join(__dirname, 'public/videos')));

const videosDir = path.join(__dirname, 'public/videos');
if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'avatar' });
});

app.post('/generate-sign-video', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Text input is required' });
        }

        console.log(`[API] Generating video for text: "${text}"`);

        // Launch Puppeteer headless browser
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--autoplay-policy=no-user-gesture-required',
                '--use-gl=angle',
                '--use-angle=swiftshader',
                '--ignore-certificate-errors'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 800, height: 600 });

        page.on('console', msg => console.log('[HeadlessRender]', msg.text()));
        page.on('pageerror', err => console.log('[HeadlessRender ERROR]', err.stack));
        page.on('requestfailed', request => console.log('[HeadlessRender REQUEST FAILED]', request.url(), request.failure().errorText));

        // Use the Express server's port for serving static React build
        const targetUrl = `http://localhost:${PORT}/headless?text=${encodeURIComponent(text)}`;
        console.log(`[API] Navigating to: ${targetUrl}`);

        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 300000 });

        console.log('[API] Waiting for generation to complete...');
        await page.waitForFunction('window.renderComplete === true', { timeout: 300000 });

        console.log('[API] Generation complete, extracting video...');

        // Extract base64 representation of the video blob
        const base64Data = await page.evaluate(() => {
            return new Promise((resolve, reject) => {
                if (!window.capturedVideoBlob) {
                    reject(new Error('No video blob found!'));
                    return;
                }
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result;
                    const base64String = result.split(',')[1];
                    resolve(base64String);
                };
                reader.onerror = reject;
                reader.readAsDataURL(window.capturedVideoBlob);
            });
        });

        await browser.close();

        // Save to filesystem
        const videoId = uuidv4();
        const videoFilename = `${videoId}.webm`;
        const videoPath = path.join(videosDir, videoFilename);

        fs.writeFileSync(videoPath, base64Data, 'base64');
        console.log(`[API] Video saved to ${videoPath}`);

        const videoUrl = `${req.protocol}://${req.get('host')}/videos/${videoFilename}`;

        res.status(200).json({
            status: "success",
            video_url: videoUrl,
            format: "webm"
        });

    } catch (error) {
        console.error('[API] Error generating video:', error);
        res.status(500).json({ error: 'Rendering failure', details: error.message });
    }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Backend API running on port ${PORT}`);
});
