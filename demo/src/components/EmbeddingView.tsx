import { useRef, useEffect } from "react";

interface Props {
  values: number[];
  width?: number;
  height?: number;
  stats?: { mean: number; std: number; min: number; max: number };
}

export default function EmbeddingView({
  values,
  width = 800,
  height = 200,
  stats,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || values.length === 0) return;

    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, width, height);

    // 中线
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // 找范围
    const maxAbs = Math.max(...values.map(Math.abs), 0.01);
    const barWidth = width / values.length;

    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      const barHeight = (val / maxAbs) * (height / 2 - 10);
      const x = i * barWidth;

      // 正值蓝色，负值橙色
      ctx.fillStyle = val >= 0 ? "#3b82f6" : "#f97316";
      ctx.fillRect(x, height / 2 - barHeight, Math.max(barWidth - 0.5, 0.5), barHeight);
    }

    // 标签
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.fillText(`维度: ${values.length}`, 8, 16);
  }, [values, width, height]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ width, height, borderRadius: 8 }}
        className="w-full"
      />
      {stats && (
        <div className="flex gap-6 mt-3 text-sm text-slate-400">
          <span>均值: {stats.mean.toFixed(3)}</span>
          <span>标准差: {stats.std.toFixed(3)}</span>
          <span>最小值: {stats.min.toFixed(3)}</span>
          <span>最大值: {stats.max.toFixed(3)}</span>
        </div>
      )}
      <p className="text-xs text-slate-500 mt-2">
        蓝色 = 正值，橙色 = 负值。这串数字就是这个声音的"指纹"——不同人的声音会产生不同的图案。
      </p>
    </div>
  );
}
