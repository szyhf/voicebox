import { useState } from "react";
import * as api from "../api";
import type { EmbedResult } from "../api";
import EmbeddingView from "../components/EmbeddingView";

interface Props {
  audioPath: string;
  referenceText: string;
  onComplete: (result: EmbedResult) => void;
}

export default function Step4Embedding({ audioPath, referenceText, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmbedResult | null>(null);
  const [status, setStatus] = useState("");

  const run = async () => {
    setLoading(true);
    setStatus("正在加载 AI 模型...");
    console.log("[步骤4-声纹提取] 开始提取，音频路径:", audioPath, "参考文本:", referenceText);
    try {
      setStatus("正在提取声纹特征...");
      const res = await api.embed(audioPath, referenceText);
      console.log("[步骤4-声纹提取] 完成，字段数:", res.prompt_keys.length, "tensor数:", res.tensors.length);
      res.tensors.forEach((t) => {
        console.log(`  - ${t.key}: shape=[${t.shape}] 均值=${t.stats.mean.toFixed(3)}`);
      });
      setResult(res);
      onComplete(res);
      setStatus("");
    } catch (e) {
      console.error("[步骤4-声纹提取] 失败:", e);
      setStatus("失败: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 找主要的 embedding tensor（通常维度在 256-1024 之间的就是声纹向量）
  const mainTensor = result?.tensors?.find(
    (t) => t.shape.length <= 2 && t.values.length >= 128 && t.values.length <= 1024
  );

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/50 rounded-xl p-4 text-sm text-slate-300 leading-relaxed">
        <p>
          AI 模型会从频谱图中提取出<strong className="text-blue-400">声纹向量（Speaker Embedding）</strong>。
          这是一个固定长度的数字数组，可以看作这个声音的"指纹"：
        </p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-slate-400">
          <li>每个人的声音指纹都是独一无二的</li>
          <li>同一个人说不同的话，指纹几乎不变</li>
          <li>不同的人说同样的话，指纹差别很大</li>
          <li>AI 后续会根据这个指纹来模仿你的声音</li>
        </ul>
      </div>

      <button
        onClick={run}
        disabled={loading}
        className="px-6 py-3 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {loading ? status || "提取中..." : "▶ 提取声纹"}
      </button>

      {loading && (
        <div className="bg-slate-900/50 rounded-xl p-6 border border-blue-800/50">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-end gap-1 h-12">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                <div
                  key={i}
                  className="w-2 bg-amber-500 rounded-full animate-pulse"
                  style={{
                    height: `${20 + Math.sin(i * 0.8) * 30 + 30}%`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: `${0.6 + (i % 3) * 0.2}s`,
                  }}
                />
              ))}
            </div>
            <div className="text-center space-y-1">
              <p className="text-amber-400 font-medium">{status || "正在提取声纹..."}</p>
              <p className="text-xs text-slate-500">AI 模型正在分析音频特征，首次运行需要加载模型</p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          {/* 提示字典结构 */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h4 className="text-sm text-slate-400 mb-2">模型输出的提示字典包含 {result.prompt_keys.length} 个字段：</h4>
            <div className="flex flex-wrap gap-2">
              {result.tensors.map((t) => (
                <span key={t.key} className="px-2 py-1 rounded bg-slate-600 text-xs font-mono text-blue-300">
                  {t.key} [{t.shape.join("×")}]
                </span>
              ))}
            </div>
          </div>

          {/* 主 embedding 可视化 */}
          {mainTensor && (
            <div>
              <h4 className="text-sm text-slate-400 mb-2">
                声纹向量可视化（字段: <code className="text-blue-400">{mainTensor.key}</code>，{mainTensor.values.length} 维）
              </h4>
              <EmbeddingView
                values={mainTensor.values}
                stats={mainTensor.stats}
              />
            </div>
          )}

          {/* 其他 tensor 概要 */}
          {result.tensors.length > 1 && (
            <div>
              <h4 className="text-sm text-slate-400 mb-2">其他特征张量</h4>
              <div className="space-y-2">
                {result.tensors
                  .filter((t) => t !== mainTensor)
                  .map((t) => (
                    <div key={t.key} className="flex items-center gap-3 text-sm">
                      <code className="text-blue-300 font-mono">{t.key}</code>
                      <span className="text-slate-500">[{t.shape.join("×")}]</span>
                      <span className="text-slate-500">
                        均值={t.stats.mean.toFixed(3)} 标准差={t.stats.std.toFixed(3)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
