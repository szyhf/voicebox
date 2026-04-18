import { useState } from "react";
import * as api from "../api";
import type { SpectrogramResult } from "../api";
import SpectrogramView from "../components/SpectrogramView";

interface Props {
  audioPath: string;
  onComplete: (result: SpectrogramResult) => void;
}

export default function Step3Spectrogram({ audioPath, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpectrogramResult | null>(null);

  const run = async () => {
    setLoading(true);
    console.log("[步骤3-频谱分析] 开始计算，音频路径:", audioPath);
    try {
      const res = await api.spectrogram(audioPath);
      console.log("[步骤3-频谱分析] 完成，矩阵:", res.n_mels, "×", res.n_frames);
      setResult(res);
      onComplete(res);
    } catch (e) {
      console.error("[步骤3-频谱分析] 失败:", e);
      alert("频谱分析失败: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/50 rounded-xl p-4 text-sm text-slate-300 leading-relaxed">
        <p>
          人耳能分辨声音的<strong className="text-blue-400">高低音</strong>和<strong className="text-blue-400">音量变化</strong>，
          但计算机看到的是一串数字。<strong>梅尔频谱图</strong>是一种把声音"拍成照片"的方法：
        </p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-slate-400">
          <li>横轴 = 时间（从左到右）</li>
          <li>纵轴 = 频率（低音在下，高音在上）</li>
          <li>颜色 = 该频率在该时刻的能量强度</li>
        </ul>
        <p className="mt-2 text-slate-400">它模拟了人耳对声音频率的感知方式，是 AI 处理语音的第一步。</p>
      </div>

      <button
        onClick={run}
        disabled={loading}
        className="px-6 py-3 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {loading ? "正在计算..." : "▶ 计算频谱图"}
      </button>

      {loading && (
        <div className="bg-slate-900/50 rounded-xl p-6 border border-blue-800/50">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-end gap-1 h-12">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                <div
                  key={i}
                  className="w-2 bg-purple-500 rounded-full animate-pulse"
                  style={{
                    height: `${20 + Math.sin(i * 0.8) * 30 + 30}%`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: `${0.6 + (i % 3) * 0.2}s`,
                  }}
                />
              ))}
            </div>
            <div className="text-center space-y-1">
              <p className="text-purple-400 font-medium">正在计算梅尔频谱图...</p>
              <p className="text-xs text-slate-500">将音频转换为频率-时间矩阵，请稍候</p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <SpectrogramView melData={result.mel_spectrogram} />

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <p className="text-slate-500">频率通道</p>
              <p className="text-blue-400 font-mono text-lg">{result.n_mels}</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <p className="text-slate-500">时间帧数</p>
              <p className="text-blue-400 font-mono text-lg">{result.n_frames}</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <p className="text-slate-500">数据矩阵大小</p>
              <p className="text-blue-400 font-mono text-lg">{result.n_mels} × {result.n_frames}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
