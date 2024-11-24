const express = require("express");
const { exec, spawn } = require("child_process");
const multer = require("multer");
const path = require("path");
// socket io
const http = require('http');
const socketIo = require('socket.io');
const { emit } = require("process");

const app = express();
const PORT = 3000;

const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "photos")));
app.use(express.json());

// Check camera connection
app.get("/check-camera", (req, res) => {
    exec("gphoto2 --auto-detect", (error, stdout) => {
        if (error) {
            return res.status(500).json({ message: "Camera not detected", error });
        }
        res.json({ message: "Camera detected", output: stdout });
    });
});

// Capture photo
app.post("/capture", (req, res) => {
    const photoName = `photo_${Date.now()}.jpg`;
    const photoPath = `photos/${photoName}`;
    exec(`gphoto2 --capture-image-and-download --filename=${photoPath}`, (error) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: "Failed to capture photo", error });
        }
        res.json({ message: "Photo captured successfully", photoName });
    });
});

// socket io
let gphoto2 = null;

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    gphoto2 = spawn('gphoto2', ['--stdout', '--capture-movie']);
    const ffmpeg = spawn('ffmpeg', [
        '-f', 'mjpeg',
        '-framerate', '10',
        '-i', 'pipe:0',
        '-f', 'mjpeg',  // Output MJPEG for simplicity (can be changed to other formats)
        'pipe:1'         // Pipe output to stdout
    ]);
    gphoto2.stdout.pipe(ffmpeg.stdin);
    ffmpeg.stdout.on('data', (data) => {
        var base64 = data.toString('base64');
        io.emit('video', base64);
    });

    socket.on('message', (msg) => {
        console.log('Message received:', msg);
        io.emit('message', msg);
    });

    socket.on('disconnect', () => {
        gphoto2.kill();
        console.log('A user disconnected:', socket.id);
    });
});






// Start server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
