import { useState } from "react";
import * as api from "../api";
import type { PreprocessResult } from "../api";
import WaveformView from "../components/WaveformView";

interface Props {
  audioPath: string;
  onComplete: (result: PreprocessResult) => void;
}

export default function Step2Preprocess({ audioPath, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreprocessResult | null>(null);

  const run = async () => {
    setLoading(true);
    console.log("[步骤2-预处理] 开始预处理，音频路径:", audioPath);
    try {
      const res = await api.preprocess(audioPath);
      console.log("[步骤2-预处理] 完成，时长:", res.duration.toFixed(1), "s，波形点数:", res.original_waveform.length);
      setResult(res);
      onComplete(res);
    } catch (e) {
      console.error("[步骤2-预处理] 失败:", e);
      alert("预处理失败: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/50 rounded-xl p-4 text-sm text-slate-300 leading-relaxed">
        <p>
          原始录音可能音量忽大忽小、格式不统一。<strong className="text-blue-400">音频预处理</strong>会把音频调整到标准状态：
        </p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-slate-400">
          <li>统一采样率到 24000 Hz</li>
          <li>转换为单声道</li>
          <li>归一化音量到 -20 dB</li>
          <li>限制峰值不超过 0.85（防止削波失真）</li>
        </ul>
      </div>

      <button
        onClick={run}
        disabled={loading}
        className="px-6 py-3 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {loading ? "正在处理..." : "▶ 执行预处理"}
      </button>

      {loading && (
        <div className="bg-slate-900/50 rounded-xl p-6 border border-blue-800/50">
          <div className="flex flex-col items-center gap-4">
            {/* 脉冲波形动画 */}
            <div className="flex items-end gap-1 h-12">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                <div
                  key={i}
                  className="w-2 bg-blue-500 rounded-full animate-pulse"
                  style={{
                    height: `${20 + Math.sin(i * 0.8) * 30 + 30}%`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: `${0.6 + (i % 3) * 0.2}s`,
                  }}
                />
              ))}
            </div>
            <div className="text-center space-y-1">
              <p className="text-blue-400 font-medium">正在执行音频预处理...</p>
              <p className="text-xs text-slate-500">首次运行需要加载模型，可能需要 30 秒以上，请耐心等待</p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          {/* 指标对比 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-700/50 rounded-lg p-4">
              <h4 className="text-sm text-slate-400 mb-2">处理前</h4>
              <div className="space-y-1 text-sm">
                <p>RMS 音量: <span className="text-orange-400 font-mono">{result.original_rms.toFixed(4)}</span></p>
                <p>峰值: <span className="text-orange-400 font-mono">{result.original_peak.toFixed(4)}</span></p>
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4">
              <h4 className="text-sm text-slate-400 mb-2">处理后</h4>
              <div className="space-y-1 text-sm">
                <p>RMS 音量: <span className="text-green-400 font-mono">{result.normalized_rms.toFixed(4)}</span></p>
                <p>峰值: <span className="text-green-400 font-mono">{result.normalized_peak.toFixed(4)}</span></p>
              </div>
            </div>
          </div>

          {/* 波形对比 */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm text-slate-400 mb-2">原始波形</h4>
              <WaveformView data={result.original_waveform} height={100} color="#f97316" />
              <audio controls src={api.audioUrl(audioPath)} className="w-full h-8 mt-2" />
            </div>
            <div>
              <h4 className="text-sm text-slate-400 mb-2">归一化后波形</h4>
              <WaveformView data={result.normalized_waveform} height={100} color="#22c55e" />
              <audio controls src={api.audioUrl(result.processed_audio_path)} className="w-full h-8 mt-2" />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            音频时长: {result.duration.toFixed(1)} 秒 | 采样率: {result.sample_rate} Hz | 数据点: {result.original_waveform.length}（降采样后）
          </p>
        </div>
      )}
    </div>
  );
}
