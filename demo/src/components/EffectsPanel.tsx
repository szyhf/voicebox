interface Props {
  pitch: number;
  reverb: number;
  gain: number;
  onChange: (effects: { pitch: number; reverb: number; gain: number }) => void;
}

export default function EffectsPanel({ pitch, reverb, gain, onChange }: Props) {
  return (
    <div className="space-y-5">
      {/* 变调 */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-300">变调（半音）</span>
          <span className="text-blue-400 font-mono">{pitch > 0 ? "+" : ""}{pitch}</span>
        </div>
        <input
          type="range"
          min={-12}
          max={12}
          step={1}
          value={pitch}
          onChange={(e) => onChange({ pitch: Number(e.target.value), reverb, gain })}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-slate-600">
          <span>-12 低沉</span>
          <span>0 原音</span>
          <span>+12 尖锐</span>
        </div>
      </div>

      {/* 混响 */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-300">混响强度</span>
          <span className="text-blue-400 font-mono">{reverb}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={reverb}
          onChange={(e) => onChange({ pitch, reverb: Number(e.target.value), gain })}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-slate-600">
          <span>0 干</span>
          <span>100 湿</span>
        </div>
      </div>

      {/* 增益 */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-300">音量（dB）</span>
          <span className="text-blue-400 font-mono">{gain > 0 ? "+" : ""}{gain} dB</span>
        </div>
        <input
          type="range"
          min={-20}
          max={20}
          step={2}
          value={gain}
          onChange={(e) => onChange({ pitch, reverb, gain: Number(e.target.value) })}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-slate-600">
          <span>-20 安静</span>
          <span>0 原音</span>
          <span>+20 响亮</span>
        </div>
      </div>
    </div>
  );
}
