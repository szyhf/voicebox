import { useState } from "react";
import * as api from "../api";
import EffectsPanel from "../components/EffectsPanel";
import AudioPlayer from "../components/AudioPlayer";

interface Props {
  audioPath: string;
}

export default function Step6Effects({ audioPath }: Props) {
  const [effects, setEffects] = useState({ pitch: 0, reverb: 0, gain: 0 });
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>("");

  const apply = async () => {
    setLoading(true);
    try {
      const res = await api.generate(
        "效果预览",
        audioPath,
        "效果预览",
        () => {},  // no progress display for effects
        effects,
      );
      setAudioUrl(res.audio_url);
    } catch (e) {
      alert("应用音效失败: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/50 rounded-xl p-4 text-sm text-slate-300 leading-relaxed">
        <p>
          最后一步是<strong className="text-blue-400">后期音效处理</strong>。
          就像拍照后可以加滤镜一样，我们可以给生成的声音添加各种效果，
          让它听起来像机器人、像在山谷中回响、或者变得更加低沉。
        </p>
      </div>

      <EffectsPanel
        pitch={effects.pitch}
        reverb={effects.reverb}
        gain={effects.gain}
        onChange={setEffects}
      />

      <button
        onClick={apply}
        disabled={loading}
        className="px-6 py-3 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {loading ? "处理中..." : "▶ 应用音效并试听"}
      </button>

      {audioUrl && (
        <div className="space-y-3">
          <AudioPlayer src={audioUrl} label="处理后的语音：" />
        </div>
      )}
    </div>
  );
}
