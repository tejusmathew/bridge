import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { useLocation } from "react-router-dom";

import botModel from '../Models/ybot/ybot.glb';
import * as words from '../Animations/words';
import * as alphabets from '../Animations/alphabets';
import { defaultPose } from '../Animations/defaultPose';

function HeadlessRender() {
    window.onerror = function (message, source, lineno, colno, error) {
        console.error("GLOBAL ERROR:", error ? error.stack : message);
    };
    window.addEventListener("unhandledrejection", function (promiseRejectionEvent) {
        console.error("UNHANDLED PROMISE ERROR:", promiseRejectionEvent.reason ? promiseRejectionEvent.reason.stack : promiseRejectionEvent.reason);
    });

    const componentRef = useRef({});
    const { current: ref } = componentRef;
    const location = useLocation();

    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const textParam = urlParams.get('text') || '';

        ref.flag = false;
        ref.pending = false;
        ref.animations = [];
        ref.characters = [];
        const speed = 0.15; // Faster for backend generation
        const pauseTime = 300; // Shorter pauses

        ref.scene = new THREE.Scene();
        ref.scene.background = new THREE.Color(0xdddddd);

        const spotLight = new THREE.SpotLight(0xffffff, 2);
        spotLight.position.set(0, 5, 5);
        ref.scene.add(spotLight);

        // Required for capturing from canvas smoothly
        ref.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        ref.camera = new THREE.PerspectiveCamera(30, 800 / 600, 0.1, 1000);
        ref.renderer.setSize(800, 600);

        const canvasContainer = document.getElementById("canvas-container");
        if (canvasContainer) {
            canvasContainer.innerHTML = "";
            canvasContainer.appendChild(ref.renderer.domElement);
        }

        ref.camera.position.z = 1.6;
        ref.camera.position.y = 1.4;

        // Start Recording setup
        const canvas = ref.renderer.domElement;
        const stream = canvas.captureStream(30); // 30 fps
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        const recordedChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            console.log("MediaRecorder stopped. Creating blob...");
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            window.capturedVideoBlob = blob;
            window.renderComplete = true; // Signal for Puppeteer
        };

        let isRecording = false;

        const startRecording = () => {
            if (!isRecording) {
                console.log("Starting MediaRecorder...");
                mediaRecorder.start();
                isRecording = true;
            }
        };

        const stopRecording = () => {
            if (isRecording && mediaRecorder.state !== 'inactive') {
                console.log("Stopping MediaRecorder...");
                mediaRecorder.stop();
                isRecording = false;
            }
        };

        const loader = new GLTFLoader();
        loader.load(
            botModel,
            (gltf) => {
                gltf.scene.traverse((child) => {
                    if (child.type === 'SkinnedMesh') {
                        child.frustumCulled = false;
                    }
                });
                ref.avatar = gltf.scene;
                ref.scene.add(ref.avatar);
                defaultPose(ref);

                console.log("Avatar loaded. Processing text...");
                processTextAndAnimate(textParam.toUpperCase());
            },
            (xhr) => {
                // Loading progress...
            }
        );

        const processTextAndAnimate = (textToProcess) => {
            if (!ref.animations) {
                console.log("[HeadlessRender] ref.animations somehow undefined, fixing.");
                ref.animations = [];
            }

            const strWords = textToProcess.split(' ');
            for (let word of strWords) {
                if (words[word]) {
                    ref.animations.push(['add-text', word + ' ']);
                    words[word](ref);
                } else {
                    for (const [index, ch] of word.split('').entries()) {
                        if (index === word.length - 1)
                            ref.animations.push(['add-text', ch + ' ']);
                        else
                            ref.animations.push(['add-text', ch]);
                        if (alphabets[ch]) {
                            try {
                                alphabets[ch](ref);
                            } catch (e) {
                                console.log('[HeadlessRender ERROR] inside letter ' + ch + ': ' + e.message);
                            }
                        }
                    }
                }
            }

            // Mark end of animations
            ref.animations.push(['end-recording']);

            // Start recording immediately before starting animation loop
            startRecording();
            // ref.animate() is already running from defaultPose(ref)
        };

        ref.animate = () => {
            if (ref.animations.length === 0) {
                // If somehow empty before finishing
                if (isRecording) {
                    stopRecording();
                }
                return;
            }

            requestAnimationFrame(ref.animate);

            // Throttle logging to prevent console spam
            if (!ref.lastAnimLength || ref.lastAnimLength !== ref.animations.length) {
                console.log(`[HeadlessRender] Animations remaining: ${ref.animations.length}`);
                ref.lastAnimLength = ref.animations.length;
            }

            if (ref.animations.length > 0 && ref.animations[0][0] === 'end-recording') {
                ref.animations.shift(); // remove it
                stopRecording();
                return;
            }

            if (ref.animations.length > 0 && ref.animations[0] !== undefined && ref.animations[0].length > 0) {
                if (!ref.flag) {
                    if (ref.animations[0][0] === 'add-text') {
                        // We do not need to display text for headless
                        ref.animations.shift();
                    } else {
                        for (let i = 0; i < ref.animations[0].length;) {
                            let [boneName, action, axis, limit, sign] = ref.animations[0][i];
                            const bone = ref.avatar.getObjectByName(boneName);
                            if (bone) {
                                if (sign === "+" && bone[action][axis] < limit) {
                                    bone[action][axis] += speed;
                                    bone[action][axis] = Math.min(bone[action][axis], limit);
                                    i++;
                                } else if (sign === "-" && bone[action][axis] > limit) {
                                    bone[action][axis] -= speed;
                                    bone[action][axis] = Math.max(bone[action][axis], limit);
                                    i++;
                                } else {
                                    ref.animations[0].splice(i, 1);
                                }
                            } else {
                                // Skip if bone not found to avoid crashing
                                ref.animations[0].splice(i, 1);
                            }
                        }
                    }
                }
            } else if (ref.animations.length > 0 && (ref.animations[0] === undefined || ref.animations[0].length === 0)) {
                ref.flag = true;
                setTimeout(() => {
                    ref.flag = false;
                }, pauseTime);
                ref.animations.shift();
            }

            if (ref.renderer) {
                ref.renderer.render(ref.scene, ref.camera);
            }
        };

        return () => {
            if (isRecording && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            // Cleanup webgl renderer
            if (ref.renderer) {
                ref.renderer.dispose();
                ref.renderer.forceContextLoss();
            }
        };
    }, [ref, location.search]);

    return (
        <div style={{ width: '800px', height: '600px', margin: 0, padding: 0, overflow: 'hidden' }}>
            <div id='canvas-container' style={{ width: '100%', height: '100%' }} />
        </div>
    );
}

export default HeadlessRender;
