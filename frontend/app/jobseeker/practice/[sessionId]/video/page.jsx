'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Award,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  Mic,
  MicOff,
  Play,
  Send,
  Shield,
  Sparkles,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { api } from '@/lib/api/client';
import { useCareerResource, ResourceState, errorLabel } from '@/components/career-data';
import { FieldError, fieldErrorsFrom } from '@/components/async-state';
import { VideoInterviewAnalyzer } from '@/lib/video-interview-analyzer';

const ANSWER_LIMIT_SEC = 120;

function formatClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
}

export default function VideoPracticeStudioPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = typeof params?.sessionId === 'string' ? params.sessionId : '';

  const sessionRes = useCareerResource(
    sessionId ? `practice:session:${sessionId}` : null,
    (signal) => api.practice.getSession(sessionId, signal),
  );

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const analyzerRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastSpokenTurnIdRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [visionStatus, setVisionStatus] = useState('idle'); // idle | loading | ready | fallback
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(true);

  const [recording, setRecording] = useState(false);
  const [answerCountdown, setAnswerCountdown] = useState(ANSWER_LIMIT_SEC);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [speakingSeconds, setSpeakingSeconds] = useState(0);

  const [answer, setAnswer] = useState('');
  const [interimText, setInterimText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [starting, setStarting] = useState(false);
  const [aiNotice, setAiNotice] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [metrics, setMetrics] = useState({
    eye_contact_pct: 78,
    posture_pct: 80,
    confidence_score: 77,
    body_language_score: 79,
    voice_energy_pct: 74,
  });
  const [liveMicLevel, setLiveMicLevel] = useState(0);
  const [sessionData, setSessionData] = useState(null);

  useEffect(() => {
    if (sessionRes.data) {
      setSessionData(sessionRes.data);
    }
  }, [sessionRes.data]);

  const session = sessionData;
  const isInProgress = session?.status === 'in_progress';

  // Detect Web Speech API support
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRec));
  }, []);

  // Session elapsed clock
  useEffect(() => {
    if (!isInProgress) return undefined;
    const id = setInterval(() => setTotalSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [isInProgress]);

  // Per-answer 2-minute countdown while recording
  useEffect(() => {
    if (!recording) return undefined;
    const id = setInterval(() => {
      setSpeakingSeconds((prev) => prev + 1);
      setAnswerCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [recording]);

  // Auto-stop recording when 2-min countdown hits 0
  useEffect(() => {
    if (recording && answerCountdown === 0) {
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, answerCountdown]);

  // Keep stream attached to <video> if React re-renders
  useEffect(() => {
    if (cameraReady && videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraReady, session?.status]);

  // Body language + mic level analysis loop
  useEffect(() => {
    if (!cameraReady) return undefined;
    const id = setInterval(() => {
      if (analyzerRef.current && videoRef.current) {
        const next = analyzerRef.current.analyzeVideoFrame(videoRef.current, performance.now());
        setMetrics(next);
        const energy = analyzerRef.current.sampleAudioEnergy();
        if (energy != null) setLiveMicLevel(energy);
      }
    }, 350);
    return () => clearInterval(id);
  }, [cameraReady]);

  // Speak latest interviewer question via SpeechSynthesis
  const turns = session?.turns || [];
  const latestInterviewerTurn = [...turns].reverse().find((t) => t.speaker === 'interviewer');

  const speakText = useCallback((text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.0;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore TTS errors
    }
  }, []);

  useEffect(() => {
    if (!ttsEnabled || !latestInterviewerTurn) return;
    if (lastSpokenTurnIdRef.current === latestInterviewerTurn.id) return;
    lastSpokenTurnIdRef.current = latestInterviewerTurn.id;
    speakText(latestInterviewerTurn.content);
  }, [latestInterviewerTurn, ttsEnabled, speakText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
      try {
        analyzerRef.current?.destroy();
      } catch {}
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const enableCamera = async () => {
    setCameraError('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Your browser does not support webcam access.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraReady(true);

      const analyzer = new VideoInterviewAnalyzer();
      analyzer.initAudio(stream);
      analyzerRef.current = analyzer;
      setVisionStatus('loading');
      const ok = await analyzer.initVision();
      setVisionStatus(ok ? 'ready' : 'fallback');
    } catch (err) {
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera/microphone permission was denied. Allow access in your browser or switch to Text Mode.'
          : 'Could not access camera or microphone. Check your device settings.',
      );
    }
  };

  const startRecording = () => {
    setError('');
    setAnswerCountdown(ANSWER_LIMIT_SEC);
    setRecording(true);

    if (typeof window === 'undefined') return;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const text = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            finalChunk += `${text} `;
          } else {
            interimChunk += text;
          }
        }
        if (finalChunk) {
          setAnswer((prev) => `${prev ? `${prev.trim()} ` : ''}${finalChunk.trim()}`.trim());
        }
        setInterimText(interimChunk);
      };
      rec.onerror = () => {
        // Keep manual textarea editing available
      };
      rec.start();
      recognitionRef.current = rec;
    } catch {
      // Ignore if SpeechRecognition cannot start
    }
  };

  const stopRecording = () => {
    setRecording(false);
    setInterimText('');
    try {
      recognitionRef.current?.stop();
    } catch {}
    recognitionRef.current = null;
  };

  const handleStartSession = async () => {
    if (!sessionId) return;
    setStarting(true);
    setError('');
    try {
      const updated = await api.practice.startSession(sessionId);
      setSessionData(updated);
    } catch (err) {
      setError(errorLabel(err, 'Could not start session.'));
    } finally {
      setStarting(false);
    }
  };

  const handleSubmitTurn = async (e) => {
    e.preventDefault();
    if (recording) stopRecording();
    const combined = `${answer} ${interimText}`.trim();
    if (!sessionId || !combined) return;
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    try {
      const resp = await api.practice.submitTurn(sessionId, { content: combined });
      setAnswer('');
      setInterimText('');
      setAnswerCountdown(ANSWER_LIMIT_SEC);
      if (resp.ai_notice) setAiNotice(resp.ai_notice);
      setSessionData((prev) => {
        if (!prev) return prev;
        const added = [resp.candidate_turn, resp.interviewer_turn].filter(Boolean);
        return {
          ...prev,
          status: prev.status === 'scheduled' ? 'in_progress' : prev.status,
          turns: [...(prev.turns || []), ...added],
        };
      });
    } catch (err) {
      setFieldErrors(fieldErrorsFrom(err));
      setError(errorLabel(err, 'Could not submit response.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleScore = async () => {
    if (recording) stopRecording();
    if (!sessionId) return;
    setScoring(true);
    setError('');
    try {
      const candidateTexts = turns
        .filter((t) => t.speaker === 'candidate')
        .map((t) => t.content);
      const summary = analyzerRef.current
        ? analyzerRef.current.getSummaryScores(candidateTexts, Math.max(15, speakingSeconds))
        : {
            confidence_score: metrics.confidence_score,
            body_language_score: metrics.body_language_score,
            communication_score: 75,
          };

      await api.practice.scoreSession(sessionId, {
        duration_sec: Math.max(1, totalSeconds),
        confidence_score: summary.confidence_score,
        body_language_score: summary.body_language_score,
        communication_score: summary.communication_score,
      });
      router.push(`/jobseeker/practice/${sessionId}/report`);
    } catch (err) {
      setError(errorLabel(err, 'Could not generate AI video score report.'));
      setScoring(false);
    }
  };

  const candidateTurnsCount = turns.filter((t) => t.speaker === 'candidate').length;
  const currentQuestionNum = Math.min(candidateTurnsCount + 1, session?.question_count || 1);

  return (
    <JobSeekerShell active="Interview practice">
      <div className="space-y-6 max-w-6xl pb-10">
        <ResourceState
          resource={sessionRes}
          empty={!sessionRes.loading && !sessionRes.error && !session}
          emptyTitle="Practice session not found"
          emptyBody="This session may have been deleted or belongs to another account."
          onRetry={sessionRes.reload}
        >
          {session && (
            <>
              {/* Header */}
              <header className="rounded-2xl border border-[#E5E1D8] bg-[#0F1B2D] p-5 text-white flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-[#B8955A] uppercase tracking-wider block mb-0.5">
                    Video AI Practice Studio
                  </span>
                  <h1 className="text-lg md:text-xl font-serif font-bold text-white">
                    {session.title || session.target_role || 'Video Practice Session'}
                  </h1>
                  <p className="text-xs text-white/70 mt-0.5">
                    Question {currentQuestionNum} of {session.question_count} ·{' '}
                    <span className="capitalize">{session.status.replace('_', ' ')}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !ttsEnabled;
                      setTtsEnabled(next);
                      if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                      }
                    }}
                    className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 flex items-center gap-1.5 text-xs text-white/90 hover:bg-white/20"
                  >
                    {ttsEnabled ? <Volume2 size={14} className="text-[#B8955A]" /> : <VolumeX size={14} />}
                    {ttsEnabled ? 'Voice On' : 'Muted'}
                  </button>

                  <div className="rounded-xl border border-white/20 bg-white/10 px-3.5 py-1.5 flex items-center gap-2 text-xs">
                    <Clock size={14} className="text-[#B8955A]" />
                    <span className="font-mono text-sm font-semibold">{formatClock(totalSeconds)}</span>
                  </div>

                  <Link href={`/jobseeker/practice/${session.id}`}>
                    <button
                      type="button"
                      className="rounded-xl border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                    >
                      Text Mode
                    </button>
                  </Link>
                </div>
              </header>

              {error && (
                <div className="rounded-xl border border-[#F2C6C2] bg-[#FEF3F2] px-4 py-3 text-xs text-[#B42318]">
                  {error}
                </div>
              )}

              {aiNotice && (
                <div className="rounded-xl border border-[#D4C3A3] bg-[#FFF8E8] px-4 py-2.5 text-xs text-[#806236]">
                  {aiNotice}
                </div>
              )}

              {session.status === 'completed' && (
                <div className="rounded-2xl border border-[#CDE5D7] bg-[#E7F3EC] p-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-[#286749] font-medium">
                    <CheckCircle2 size={16} />
                    This video session is completed (Score: {session.score ?? '—'}%).
                  </div>
                  <Link href={`/jobseeker/practice/${session.id}/report`}>
                    <JobBtn primary small className="flex items-center gap-1.5">
                      <Award size={13} /> View 7-Dimension Report
                    </JobBtn>
                  </Link>
                </div>
              )}

              {/* Split Studio Grid */}
              <div className="grid gap-6 lg:grid-cols-12">
                {/* Left: Webcam + Body Language HUD */}
                <section className="lg:col-span-5 space-y-4">
                  <div className="rounded-2xl border border-[#E5E1D8] bg-[#0F1B2D] overflow-hidden shadow-sm relative aspect-[4/3]">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`w-full h-full object-cover -scale-x-100 ${cameraReady ? 'block' : 'hidden'}`}
                    />
                    {!cameraReady && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
                        <Camera size={32} className="text-[#B8955A]" />
                        <p className="text-xs text-white/80 max-w-xs leading-relaxed">
                          Enable your camera &amp; microphone for live body language, eye contact, and voice analysis.
                        </p>
                        <JobBtn primary small onClick={enableCamera} className="flex items-center gap-1.5">
                          <Camera size={13} /> Enable Camera &amp; Mic
                        </JobBtn>
                        {cameraError && (
                          <p className="text-[11px] text-[#FCA5A5] max-w-xs">{cameraError}</p>
                        )}
                      </div>
                    )}

                    {cameraReady && (
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                        <span className="rounded-full bg-black/60 backdrop-blur px-2.5 py-1 text-[10px] font-semibold text-white flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${recording ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'}`} />
                          {recording ? `Recording · ${formatClock(answerCountdown)}` : 'Camera Ready'}
                        </span>
                        <span className="rounded-full bg-black/60 backdrop-blur px-2.5 py-1 text-[10px] text-white/80">
                          {visionStatus === 'ready'
                            ? 'MediaPipe Active'
                            : visionStatus === 'loading'
                              ? 'Loading Vision...'
                              : 'Audio + Browser Mode'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Language HUD Cards */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="rounded-xl border border-[#E5E1D8] bg-white p-3">
                      <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
                        <Eye size={12} className="text-[#9A7A45]" /> Eye Contact
                      </div>
                      <p className="text-lg font-serif font-bold text-[#0F1B2D] mt-0.5">
                        {metrics.eye_contact_pct}%
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E5E1D8] bg-white p-3">
                      <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
                        <UserCheck size={12} className="text-[#9A7A45]" /> Posture
                      </div>
                      <p className="text-lg font-serif font-bold text-[#0F1B2D] mt-0.5">
                        {metrics.posture_pct}%
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E5E1D8] bg-white p-3">
                      <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
                        <Sparkles size={12} className="text-[#9A7A45]" /> Confidence
                      </div>
                      <p className="text-lg font-serif font-bold text-[#0F1B2D] mt-0.5">
                        {metrics.confidence_score}%
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#D4C3A3] bg-[#F3EBDD]/40 p-3.5 text-[11px] text-[#806236] flex items-start gap-2">
                    <Shield size={14} className="shrink-0 mt-0.5" />
                    <span>
                      Video is processed locally in your browser via WASM. No video or audio is uploaded or stored.
                    </span>
                  </div>
                </section>

                {/* Right: Question + Live Transcript + Answer Controls */}
                <section className="lg:col-span-7 rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
                  {session.status === 'scheduled' && (
                    <div className="rounded-xl border border-[#D4C3A3] bg-[#FAF8F4] p-5 space-y-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#806236] block">
                          Pre-Interview Ready Check
                        </span>
                        <h2 className="text-base font-serif font-bold text-[#0F1B2D] mt-0.5">
                          Check your camera, microphone, and audio before starting
                        </h2>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 text-xs">
                        <div className="rounded-lg border border-[#E5E1D8] bg-white p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#0F1B2D]">1. Camera (Mirror View)</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                cameraReady
                                  ? 'bg-[#E7F3EC] text-[#286749]'
                                  : 'bg-[#FEF3F2] text-[#B42318]'
                              }`}
                            >
                              {cameraReady ? 'Ready' : 'Not enabled'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6B7280]">
                            {cameraReady
                              ? 'Mirrored webcam feed is active.'
                              : 'Click "Enable Camera & Mic" on the left preview.'}
                          </p>
                        </div>

                        <div className="rounded-lg border border-[#E5E1D8] bg-white p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#0F1B2D]">2. Microphone Level</span>
                            <span className="text-[10px] font-semibold text-[#6B7280]">
                              {cameraReady ? `${liveMicLevel}%` : 'Waiting'}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-[#F0EBE0] overflow-hidden">
                            <div
                              className="h-full bg-[#286749] transition-all duration-150"
                              style={{ width: `${cameraReady ? liveMicLevel : 0}%` }}
                            />
                          </div>
                        </div>

                        <div className="rounded-lg border border-[#E5E1D8] bg-white p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#0F1B2D]">3. AI Interviewer Voice</span>
                            <button
                              type="button"
                              onClick={() => speakText('Hello! Your audio and speaker check is working.')}
                              className="text-[11px] font-semibold text-[#9A7A45] hover:underline"
                            >
                              Test Audio
                            </button>
                          </div>
                          <p className="text-[11px] text-[#6B7280]">
                            Questions are read aloud automatically ({ttsEnabled ? 'On' : 'Muted'}).
                          </p>
                        </div>

                        <div className="rounded-lg border border-[#E5E1D8] bg-white p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#0F1B2D]">4. Speech-to-Text</span>
                            <span className="rounded-full bg-[#E7F3EC] px-2 py-0.5 text-[10px] font-semibold text-[#286749]">
                              {speechSupported ? 'Supported' : 'Manual Fallback'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6B7280]">
                            {speechSupported
                              ? 'Live voice transcription is ready.'
                              : 'Browser speech API unavailable; you can type/edit answers.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        {!cameraReady ? (
                          <JobBtn secondary small type="button" onClick={enableCamera} className="flex items-center gap-1.5">
                            <Camera size={13} /> Enable Camera &amp; Mic First
                          </JobBtn>
                        ) : (
                          <span className="text-xs text-[#286749] font-medium flex items-center gap-1.5">
                            <CheckCircle2 size={14} /> System check passed — you are ready!
                          </span>
                        )}

                        <JobBtn
                          primary
                          small
                          onClick={handleStartSession}
                          disabled={starting || !cameraReady}
                          className="inline-flex items-center gap-1.5"
                        >
                          <Play size={13} /> {starting ? 'Starting...' : "I'm Ready — Start Interview"}
                        </JobBtn>
                      </div>
                    </div>
                  )}

                  {/* Active Question */}
                  {latestInterviewerTurn && (
                    <div className="rounded-xl border border-[#D4C3A3] bg-[#FAF8F4] p-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#806236]">
                          AI Interviewer Question
                        </span>
                        <button
                          type="button"
                          onClick={() => speakText(latestInterviewerTurn.content)}
                          className="text-[11px] text-[#9A7A45] hover:underline flex items-center gap-1"
                        >
                          <Volume2 size={12} /> Replay Question
                        </button>
                      </div>
                      <p className="text-sm font-medium text-[#0F1B2D] leading-relaxed">
                        {latestInterviewerTurn.content}
                      </p>
                    </div>
                  )}

                  {/* Recording & Transcript Form */}
                  {session.status === 'in_progress' && (
                    <form onSubmit={handleSubmitTurn} className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label htmlFor="videoTranscript" className="text-xs font-semibold text-[#4A5568]">
                          Live Answer Transcript {!speechSupported && '(Manual typing fallback)'}
                        </label>
                        {!recording ? (
                          <JobBtn
                            secondary
                            small
                            type="button"
                            onClick={startRecording}
                            className="flex items-center gap-1.5"
                          >
                            <Mic size={13} /> Start Speaking Answer
                          </JobBtn>
                        ) : (
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="rounded-xl bg-[#B42318] text-white px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 hover:bg-[#912018]"
                          >
                            <MicOff size={13} /> Stop ({formatClock(answerCountdown)})
                          </button>
                        )}
                      </div>

                      <textarea
                        id="videoTranscript"
                        rows={5}
                        value={interimText ? `${answer} ${interimText}`.trim() : answer}
                        onChange={(e) => {
                          setInterimText('');
                          setAnswer(e.target.value);
                        }}
                        placeholder="Click 'Start Speaking Answer' to transcribe your voice live, or type/edit your response..."
                        className="w-full p-3 rounded-xl border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                      />
                      <FieldError message={fieldErrors.content} />

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <JobBtn
                          secondary
                          small
                          type="button"
                          onClick={handleScore}
                          disabled={scoring || candidateTurnsCount === 0}
                          className="flex items-center gap-1.5"
                        >
                          <Sparkles size={13} />
                          {scoring ? 'Generating 7-Dimension Score...' : 'Finish & Score Session'}
                        </JobBtn>

                        <JobBtn
                          primary
                          small
                          type="submit"
                          disabled={submitting || (!answer.trim() && !interimText.trim())}
                          className="flex items-center gap-1.5"
                        >
                          <Send size={13} />
                          {submitting ? 'Submitting...' : 'Submit Answer'}
                        </JobBtn>
                      </div>
                    </form>
                  )}

                  {/* Compact Turn History */}
                  {turns.length > 0 && (
                    <div className="pt-3 border-t border-[#F0EBE0] space-y-2 max-h-56 overflow-y-auto">
                      <span className="text-[11px] font-semibold text-[#6B7280] block">
                        Session History ({turns.length} turns)
                      </span>
                      {turns.map((turn) => (
                        <div
                          key={turn.id}
                          className={`rounded-lg p-3 text-xs ${
                            turn.speaker === 'interviewer'
                              ? 'bg-[#FAF8F4] text-[#0F1B2D]'
                              : 'bg-[#E7F3EC]/40 text-[#1F2937] ml-4'
                          }`}
                        >
                          <span className="font-bold text-[10px] uppercase text-[#806236] block mb-0.5">
                            {turn.speaker === 'interviewer' ? 'AI Interviewer' : 'You'}
                          </span>
                          <p className="whitespace-pre-line">{turn.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </ResourceState>
      </div>
    </JobSeekerShell>
  );
}
