import { useRef, useEffect } from "react";

interface Props {
  melData: number[][]; // [n_mels][n_frames], 值为 dB
  width?: number;
  height?: number;
}

// viridis-like colormap: 深紫 → 蓝 → 绿 → 黄
function colormap(t: number): [number, number, number] {
  const r = Math.min(255, Math.max(0, Math.round(255 * (1.5 * t - 0.25))));
  const g = Math.min(255, Math.max(0, Math.round(255 * Math.sin(Math.PI * t))));
  const b = Math.min(255, Math.max(0, Math.round(255 * (1.2 - 1.5 * t))));
  return [r, g, b];
}

export default function SpectrogramView({
  melData,
  width = 800,
  height = 300,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || melData.length === 0) return;

    const nMels = melData.length;
    const nFrames = melData[0]?.length || 0;
    if (nFrames === 0) return;

    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const imageData = ctx.createImageData(width, height);

    // 找全局 min/max 用于归一化
    let min = Infinity;
    let max = -Infinity;
    for (const row of melData) {
      for (const v of row) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const range = max - min || 1;

    for (let py = 0; py < height; py++) {
      // y 轴对应频率（底部=低频，顶部=高频）
      const melIdx = nMels - 1 - Math.floor((py / height) * nMels);
      const row = melData[Math.min(melIdx, nMels - 1)];

      for (let px = 0; px < width; px++) {
        const frameIdx = Math.floor((px / width) * nFrames);
        const val = (row[frameIdx] - min) / range;
        const [r, g, b] = colormap(val);

        const offset = (py * width + px) * 4;
        imageData.data[offset] = r;
        imageData.data[offset + 1] = g;
        imageData.data[offset + 2] = b;
        imageData.data[offset + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // 坐标轴标注
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.fillText("高频 →", 4, 14);
    ctx.fillText("← 低频", 4, height - 6);
    ctx.fillText("时间 →", width - 60, height - 6);
  }, [melData, width, height]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ width, height, borderRadius: 8 }}
        className="w-full"
      />
      <p className="text-xs text-slate-500 mt-2">
        横轴 = 时间 | 纵轴 = 频率（低→高）| 颜色 = 能量强度（暗→亮）
      </p>
    </div>
  );
}
