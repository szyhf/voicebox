import { useState } from "react";
import * as api from "../api";
import AudioPlayer from "../components/AudioPlayer";

interface Props {
  audioPath: string;
  referenceText: string;
  onReferenceTextChange: (text: string) => void;
  onComplete: (audioUrl: string, audioPath: string) => void;
}

const PHASE_LABELS: Record<string, string> = {
  loading_model: "加载 AI 模型",
  creating_prompt: "提取声纹特征",
  generating: "生成语音中",
  saving: "编码音频文件",
  done: "完成",
};

const PHASE_ORDER = ["loading_model", "creating_prompt", "generating", "saving"];

function getPhaseIndex(phase: string): number {
  for (let i = 0; i < PHASE_ORDER.length; i++) {
    if (phase === PHASE_ORDER[i] || phase === "done") return i;
  }
  return 0;
}

export default function Step5Generate({
  audioPath,
  referenceText,
  onReferenceTextChange,
  onComplete,
}: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [duration, setDuration] = useState<number>(0);
  const [progress, setProgress] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState("");
  const [phaseIndex, setPhaseIndex] = useState(0);

  const handleProgress = (phase: string, progress: number) => {
    setProgress(progress);
    setPhaseLabel(PHASE_LABELS[phase] || phase);
    setPhaseIndex(getPhaseIndex(phase));
  };

  const run = async () => {
    setLoading(true);
    setAudioUrl("");
    setProgress(0);
    onReferenceTextChange(text);
    console.log("[步骤5-语音合成] 开始生成，文本:", text.slice(0, 50), "...");

    try {
      const res = await api.generate(text, audioPath, referenceText, handleProgress);
      console.log("[步骤5-语音合成] 完成，音频URL:", res.audio_url, "时长:", res.duration.toFixed(1), "s");
      setAudioUrl(res.audio_url);
      setDuration(res.duration);
      onComplete(res.audio_url, "");
    } catch (e) {
      console.error("[步骤5-语音合成] 失败:", e);
      alert("语音合成失败: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/50 rounded-xl p-4 text-sm text-slate-300 leading-relaxed">
        <p>
          现在进入最关键的步骤：AI 模型根据上一步提取的<strong className="text-blue-400">声纹指纹</strong>，
          加上你输入的文字，<strong className="text-blue-400">生成全新的语音</strong>。
          听起来就像是用你的声音在说这段话！
        </p>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-2">
          输入你想让 AI 说的文字（中文）<span className="text-red-400 ml-1">*</span>
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          placeholder="请输入你想合成的内容"
        />
        <p className="text-xs text-slate-500 mt-1">{text.length}/500 字</p>
      </div>

      <button
        onClick={run}
        disabled={loading || !text.trim()}
        className="px-6 py-3 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {loading ? "生成中..." : "▶ 生成语音"}
      </button>

      {loading && (
        <div className="bg-slate-900/50 rounded-xl p-6 border border-blue-800/50 space-y-5">
          {/* 进度条 */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-green-400 font-medium">{phaseLabel}...</span>
              <span className="text-slate-500">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* 阶段指示 */}
          <div className="flex gap-1">
            {PHASE_ORDER.map((phase, i) => (
              <div key={phase} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-colors duration-300 ${
                    i < phaseIndex
                      ? "bg-green-500"
                      : i === phaseIndex
                        ? "bg-green-400 animate-pulse"
                        : "bg-slate-700"
                  }`}
                />
                <p
                  className={`text-xs mt-1 text-center truncate transition-colors duration-300 ${
                    i <= phaseIndex ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  {PHASE_LABELS[phase]}
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 text-center">
            进度由服务端实时推送 · 语音合成通常需要 1-3 分钟
          </p>
        </div>
      )}

      {audioUrl && (
        <div className="space-y-4">
          <p className="text-sm text-green-400">✓ 生成完成！时长: {duration.toFixed(1)} 秒</p>
          <AudioPlayer src={audioUrl} label="AI 生成的语音：" />
        </div>
      )}
    </div>
  );
}
