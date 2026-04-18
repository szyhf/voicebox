import { useState, useRef, useCallback, useEffect } from "react";
import * as api from "../api";

interface Props {
  onComplete: (file: File, serverPath: string) => void;
  referenceText: string;
  onReferenceTextChange: (text: string) => void;
}

export default function Step1Record({ onComplete, referenceText, onReferenceTextChange }: Props) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState(false);

  // 录音相关
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // 实时波形相关
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  // 绘制实时波形
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getFloatTimeDomainData(dataArray);

      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, w, h);

      // 中线
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // 波形
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.beginPath();

      const sliceWidth = w / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i];
        const y = ((1 - v) / 2) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
    };

    draw();
  }, []);

  const startRecording = async () => {
    setError("");
    console.log("[步骤1-录音] 开始请求麦克风权限...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      console.log("[步骤1-录音] 麦克风权限获取成功，音轨数:", stream.getAudioTracks().length);

      // 设置 AudioContext + AnalyserNode 用于实时可视化
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      console.log("[步骤1-录音] AudioContext 创建成功，采样率:", audioCtx.sampleRate);

      // 开始录音
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          console.log("[步骤1-录音] 收到数据块，大小:", (e.data.size / 1024).toFixed(1), "KB");
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        console.log("[步骤1-录音] 录音停止，总大小:", (blob.size / 1024).toFixed(1), "KB，数据块数:", chunksRef.current.length);
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      console.log("[步骤1-录音] MediaRecorder 已启动，mimeType:", recorder.mimeType);

      // 开始绘制波形
      drawWaveform();
    } catch (e) {
      console.error("[步骤1-录音] 麦克风权限获取失败:", e);
      setError("无法访问麦克风，请检查浏览器权限设置");
    }
  };

  const stopRecording = () => {
    console.log("[步骤1-录音] 用户点击停止录音");
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(animFrameRef.current);
    audioCtxRef.current?.close();
    setRecording(false);
  };

  // webm 转 wav（用浏览器 AudioContext 解码后编码为 WAV）
  const convertToWav = async (blob: Blob): Promise<Blob> => {
    console.log("[步骤1-转换] 开始 webm → wav 转换，输入大小:", (blob.size / 1024).toFixed(1), "KB");
    const arrayBuffer = await blob.arrayBuffer();
    console.log("[步骤1-转换] ArrayBuffer 大小:", (arrayBuffer.byteLength / 1024).toFixed(1), "KB");

    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioCtx.close();
    console.log("[步骤1-转换] 解码成功，采样率:", audioBuffer.sampleRate, "声道数:", audioBuffer.numberOfChannels, "时长:", audioBuffer.duration.toFixed(2), "s");

    const numChannels = 1;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const channelData = audioBuffer.getChannelData(0);

    // WAV 编码
    const wavBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(wavBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, "data");
    view.setUint32(40, length * 2, true);

    for (let i = 0; i < length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });
    console.log("[步骤1-转换] WAV 编码完成，输出大小:", (wavBlob.size / 1024).toFixed(1), "KB，采样率:", sampleRate, "Hz");
    return wavBlob;
  };

  const handleUpload = async () => {
    if (!audioBlob) return;
    setLoading(true);
    setError("");
    console.log("[步骤1-上传] 开始上传流程，原始 blob 大小:", (audioBlob.size / 1024).toFixed(1), "KB，类型:", audioBlob.type);
    try {
      // 转换 webm → wav 再上传
      const wavBlob = await convertToWav(audioBlob);
      const file = new File([wavBlob], "recording.wav", { type: "audio/wav" });
      console.log("[步骤1-上传] WAV 文件已创建，大小:", (file.size / 1024).toFixed(1), "KB");
      const path = await api.uploadAudio(file);
      console.log("[步骤1-上传] 上传成功，服务端路径:", path);
      setUploaded(true);
      onComplete(file, path);
    } catch (e) {
      console.error("[步骤1-上传] 上传失败:", e);
      setError("上传失败: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    console.log("[步骤1-文件选择] 选择文件:", file.name, "大小:", (file.size / 1024).toFixed(1), "KB，类型:", file.type);
    setLoading(true);
    setError("");
    try {
      const path = await api.uploadAudio(file);
      setAudioBlob(file);
      setAudioUrl(URL.createObjectURL(file));
      console.log("[步骤1-文件选择] 上传成功，服务端路径:", path);
      setUploaded(true);
      onComplete(file, path);
    } catch (err) {
      console.error("[步骤1-文件选择] 上传失败:", err);
      setError("上传失败: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/50 rounded-xl p-4 text-sm text-slate-300 leading-relaxed">
        <p>
          声音克隆的第一步是<strong className="text-blue-400">采集参考音频</strong>。
          请录制一段 5-10 秒的语音（也可以上传已有的音频文件）。
          这段音频将被用来"学习"你的声音特征。
        </p>
      </div>

      {/* 实时波形画布 */}
      <div className="bg-slate-900 rounded-xl p-2 border border-slate-700">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: 120 }}
        />
      </div>

      <div className="flex gap-4">
        <button
          onClick={recording ? stopRecording : startRecording}
          className={`px-6 py-3 rounded-xl font-medium transition-colors ${
            recording
              ? "bg-red-600 text-white animate-pulse"
              : "bg-blue-600 text-white hover:bg-blue-500"
          }`}
        >
          {recording ? "⏹ 停止录音" : "🎙 开始录音"}
        </button>

        <label className="px-6 py-3 rounded-xl font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 cursor-pointer transition-colors">
          📁 上传音频文件
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 rounded-lg px-4 py-2">{error}</p>
      )}

      {uploaded && (
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-5 space-y-3">
          <p className="text-green-400 font-medium text-lg">✓ 音频上传成功！</p>
          <p className="text-slate-300 text-sm">参考音频已保存到服务器，点击下方 <strong className="text-blue-400">「下一步」</strong> 继续音频预处理。</p>
        </div>
      )}

      {audioUrl && !recording && !uploaded && (
        <div className="space-y-4">
          <p className="text-sm text-green-400">✓ 录音完成</p>
          <audio controls src={audioUrl} className="w-full h-10" />

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              请输入你刚才朗读的内容（参考文本）<span className="text-red-400 ml-1">*</span>
            </label>
            <textarea
              value={referenceText}
              onChange={(e) => onReferenceTextChange(e.target.value)}
              rows={2}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="请输入你录音里说的话，用于后续校准"
            />
            <p className="text-xs text-slate-500 mt-1">参考文本越准确，克隆效果越好。必须与你录音中说的一致</p>
          </div>

          <button
            onClick={handleUpload}
            disabled={loading || !referenceText.trim()}
            className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-50"
          >
            {loading ? "上传中..." : "✓ 确认并继续"}
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-blue-400">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">正在上传...</span>
        </div>
      )}
    </div>
  );
}
