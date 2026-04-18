import { useState } from "react";
import type {
  PreprocessResult,
  SpectrogramResult,
  EmbedResult,
} from "./api";
import Step1Record from "./steps/Step1Record";
import Step2Preprocess from "./steps/Step2Preprocess";
import Step3Spectrogram from "./steps/Step3Spectrogram";
import Step4Embedding from "./steps/Step4Embedding";
import Step5Generate from "./steps/Step5Generate";

const STEPS = [
  { num: 1, title: "录制声音", desc: "用麦克风录制一段参考音频" },
  { num: 2, title: "音频预处理", desc: "归一化音量、统一格式" },
  { num: 3, title: "频谱分析", desc: "将声音转换为梅尔频谱图" },
  { num: 4, title: "声纹提取", desc: "从音频中提取声音指纹" },
  { num: 5, title: "语音合成", desc: "用 AI 模型生成新语音" },
];

export default function App() {
  const [currentStep, setCurrentStep] = useState(1);

  // 共享状态：各步骤的结果
  const [, setAudioFile] = useState<File | null>(null);
  const [audioPath, setAudioPath] = useState<string>("");
  const [referenceText, setReferenceText] = useState("");
  const [preprocessResult, setPreprocessResult] = useState<PreprocessResult | null>(null);
  const [spectrogramResult, setSpectrogramResult] = useState<SpectrogramResult | null>(null);
  const [embedResult, setEmbedResult] = useState<EmbedResult | null>(null);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string>("");

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 2: return !!audioPath && !!referenceText.trim();
      case 3: return !!preprocessResult;
      case 4: return !!spectrogramResult;
      case 5: return !!embedResult;
      default: return true;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* 顶部标题 */}
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-xl">
            🔊
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">声音克隆教学演示</h1>
            <p className="text-sm text-slate-400">
              分步体验声音克隆的完整流程
            </p>
          </div>
        </div>
      </header>

      {/* 步骤导航 */}
      <nav className="border-b border-slate-700/50 bg-slate-800/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto py-2">
            {STEPS.map((step) => {
              const active = currentStep === step.num;
              const done = step.num < currentStep;
              return (
                <button
                  key={step.num}
                  onClick={() => setCurrentStep(step.num)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors
                    ${active ? "bg-blue-600 text-white" : done ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "text-slate-500 hover:text-slate-300"}
                  `}
                >
                  <span
                    className={`
                      w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold
                      ${active ? "bg-white text-blue-600" : done ? "bg-green-500 text-white" : "bg-slate-600 text-slate-400"}
                    `}
                  >
                    {done && !active ? "✓" : step.num}
                  </span>
                  <span className="hidden sm:inline">{step.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* 当前步骤说明 */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white">
            步骤 {currentStep}：{STEPS[currentStep - 1].title}
          </h2>
          <p className="text-slate-400 mt-1">{STEPS[currentStep - 1].desc}</p>
        </div>

        {/* 步骤内容 */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          {currentStep === 1 && (
            <Step1Record
              onComplete={(file, path) => {
                setAudioFile(file);
                setAudioPath(path);
              }}
              referenceText={referenceText}
              onReferenceTextChange={setReferenceText}
            />
          )}
          {currentStep === 2 && audioPath && (
            <Step2Preprocess
              audioPath={audioPath}
              onComplete={setPreprocessResult}
            />
          )}
          {currentStep === 3 && preprocessResult && (
            <Step3Spectrogram
              audioPath={preprocessResult.processed_audio_path}
              onComplete={setSpectrogramResult}
            />
          )}
          {currentStep === 4 && spectrogramResult && (
            <Step4Embedding
              audioPath={preprocessResult?.processed_audio_path || audioPath}
              referenceText={referenceText}
              onComplete={setEmbedResult}
            />
          )}
          {currentStep === 5 && embedResult && (
            <Step5Generate
              audioPath={preprocessResult?.processed_audio_path || audioPath}
              referenceText={referenceText}
              onReferenceTextChange={setReferenceText}
              onComplete={(url) => {
                setGeneratedAudioUrl(url);
              }}
            />
          )}
        </div>

        {/* 步骤切换按钮 */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="px-5 py-2 rounded-lg bg-slate-700 text-slate-300 disabled:opacity-30 hover:bg-slate-600 transition-colors"
          >
            ← 上一步
          </button>
          <button
            onClick={() => setCurrentStep(Math.min(5, currentStep + 1))}
            disabled={currentStep === 5 || !canProceed(currentStep + 1)}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-30 hover:bg-blue-500 transition-colors"
          >
            {currentStep === 5 && generatedAudioUrl ? "✓ 合成完成" : "下一步 →"}
          </button>
        </div>
      </main>

      {/* 底部说明 */}
      <footer className="border-t border-slate-700/50 mt-12 py-6 text-center text-sm text-slate-500">
        基于 Voicebox 开源项目 · 使用 Qwen3-TTS 引擎 · 所有数据仅在本地处理
      </footer>
    </div>
  );
}
