/**
 * In-browser body language, vocal energy, and communication analyzer.
 * Runs MediaPipe FaceLandmarker + PoseLandmarker locally via WASM.
 * Video frames never leave the browser.
 */

const FILLER_REGEX = /\b(um+|uh+|er+|ah+|like|you know|basically|actually|literally|sort of|kind of)\b/gi;

function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function avg(arr, fallback = 75) {
  if (!arr.length) return fallback;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function computeCommunicationMetrics(transcripts, speakingSec) {
  const fullText = (transcripts || []).join(' ').trim();
  const words = fullText ? fullText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  if (wordCount === 0) {
    return { communication_score: 60, wpm: 0, filler_ratio: 0 };
  }

  const fillerMatches = fullText.match(FILLER_REGEX) || [];
  const fillerRatio = Math.min(0.4, fillerMatches.length / wordCount);
  const fillerScore = (1 - fillerRatio / 0.4) * 100;

  const minutes = Math.max(0.25, (speakingSec || 60) / 60);
  const wpm = wordCount / minutes;
  let pacingScore = 100;
  if (wpm < 100) {
    pacingScore = clamp((wpm / 100) * 100, 40, 100);
  } else if (wpm > 150) {
    pacingScore = clamp(100 - ((wpm - 150) / 80) * 60, 40, 100);
  }

  const avgWordsPerAnswer = wordCount / Math.max(1, (transcripts || []).length);
  const lengthScore = clamp((avgWordsPerAnswer / 65) * 100, 35, 100);

  const score = clamp(0.5 * fillerScore + 0.3 * pacingScore + 0.2 * lengthScore);
  return {
    communication_score: score,
    wpm: Math.round(wpm),
    filler_ratio: Number((fillerRatio * 100).toFixed(1)),
  };
}

export class VideoInterviewAnalyzer {
  constructor() {
    this.faceLandmarker = null;
    this.poseLandmarker = null;
    this.mediapipeReady = false;
    this.audioContext = null;
    this.analyser = null;
    this.audioData = null;

    this.eyeContactSamples = [];
    this.headStabilitySamples = [];
    this.postureSamples = [];
    this.composureSamples = [];
    this.voiceEnergySamples = [];

    this.prevNose = null;
    this.prevWrists = null;
  }

  async initVision() {
    if (typeof window === 'undefined') return false;
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { FilesetResolver, FaceLandmarker, PoseLandmarker } = vision;
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );
      this.faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      this.poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
      this.mediapipeReady = true;
      return true;
    } catch {
      this.mediapipeReady = false;
      return false;
    }
  }

  initAudio(stream) {
    if (typeof window === 'undefined' || !stream) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      this.audioData = new Uint8Array(this.analyser.frequencyBinCount);
    } catch {
      this.analyser = null;
    }
  }

  sampleAudioEnergy() {
    if (!this.analyser || !this.audioData) return null;
    this.analyser.getByteFrequencyData(this.audioData);
    let sum = 0;
    for (let i = 0; i < this.audioData.length; i += 1) {
      sum += this.audioData[i];
    }
    const avgBin = sum / this.audioData.length;
    const normalized = clamp((avgBin / 64) * 100, 15, 100);
    if (avgBin > 4) {
      this.voiceEnergySamples.push(normalized);
    }
    return normalized;
  }

  analyzeVideoFrame(videoEl, timestampMs) {
    if (!this.mediapipeReady || !videoEl || videoEl.readyState < 2) {
      return this.getLiveMetrics();
    }

    try {
      if (this.faceLandmarker) {
        const faceRes = this.faceLandmarker.detectForVideo(videoEl, timestampMs);
        const landmarks = faceRes?.faceLandmarks?.[0];
        if (landmarks && landmarks.length > 263) {
          const nose = landmarks[1];
          const leftEye = landmarks[33];
          const rightEye = landmarks[263];

          const eyeMidX = (leftEye.x + rightEye.x) / 2;
          const eyeSpan = Math.max(0.01, Math.abs(rightEye.x - leftEye.x));
          const yawOffset = Math.abs(nose.x - eyeMidX) / eyeSpan;
          const centeredX = Math.abs(nose.x - 0.5);
          const eyeScore = clamp(100 - yawOffset * 140 - centeredX * 60, 20, 100);
          this.eyeContactSamples.push(eyeScore);

          if (this.prevNose) {
            const delta = Math.hypot(nose.x - this.prevNose.x, nose.y - this.prevNose.y);
            const stability = clamp(100 - delta * 900, 25, 100);
            this.headStabilitySamples.push(stability);
          }
          this.prevNose = { x: nose.x, y: nose.y };
        }
      }

      if (this.poseLandmarker) {
        const poseRes = this.poseLandmarker.detectForVideo(videoEl, timestampMs);
        const pose = poseRes?.landmarks?.[0];
        if (pose && pose.length > 16) {
          const leftShoulder = pose[11];
          const rightShoulder = pose[12];
          const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);
          const shoulderWidth = Math.max(0.05, Math.abs(leftShoulder.x - rightShoulder.x));
          const tiltRatio = shoulderTilt / shoulderWidth;
          const posture = clamp(100 - tiltRatio * 180, 35, 100);
          this.postureSamples.push(posture);

          const leftWrist = pose[15];
          const rightWrist = pose[16];
          if (this.prevWrists) {
            const moveL = Math.hypot(
              leftWrist.x - this.prevWrists.lx,
              leftWrist.y - this.prevWrists.ly,
            );
            const moveR = Math.hypot(
              rightWrist.x - this.prevWrists.rx,
              rightWrist.y - this.prevWrists.ry,
            );
            const composure = clamp(100 - (moveL + moveR) * 220, 30, 100);
            this.composureSamples.push(composure);
          }
          this.prevWrists = {
            lx: leftWrist.x,
            ly: leftWrist.y,
            rx: rightWrist.x,
            ry: rightWrist.y,
          };
        }
      }
    } catch {
      // Ignore transient frame detection errors
    }

    this.sampleAudioEnergy();
    return this.getLiveMetrics();
  }

  getLiveMetrics() {
    const eye = clamp(avg(this.eyeContactSamples, 78));
    const stability = clamp(avg(this.headStabilitySamples, 80));
    const posture = clamp(avg(this.postureSamples, 80));
    const composure = clamp(avg(this.composureSamples, 82));
    const voice = clamp(avg(this.voiceEnergySamples, 74));

    const confidence = clamp(0.4 * eye + 0.3 * stability + 0.3 * voice);
    const bodyLanguage = clamp(0.5 * posture + 0.3 * eye + 0.2 * composure);

    return {
      mediapipe_ready: this.mediapipeReady,
      eye_contact_pct: eye,
      head_stability_pct: stability,
      posture_pct: posture,
      composure_pct: composure,
      voice_energy_pct: voice,
      confidence_score: confidence,
      body_language_score: bodyLanguage,
    };
  }

  getSummaryScores(transcripts, speakingSec) {
    const live = this.getLiveMetrics();
    const comm = computeCommunicationMetrics(transcripts, speakingSec);
    return {
      ...live,
      ...comm,
    };
  }

  destroy() {
    try {
      this.faceLandmarker?.close();
    } catch {}
    try {
      this.poseLandmarker?.close();
    } catch {}
    try {
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }
    } catch {}
    this.faceLandmarker = null;
    this.poseLandmarker = null;
    this.audioContext = null;
  }
}
