import { useRef, useEffect } from "react";

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  label?: string;
}

export default function WaveformView({
  data,
  width = 800,
  height = 150,
  color = "#3b82f6",
  label,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 清空
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, width, height);

    // 中线
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // 波形
    const step = Math.ceil(data.length / width);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
      const idx = i * step;
      const val = data[Math.min(idx, data.length - 1)] || 0;
      const y = ((1 - val) / 2) * height;
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.stroke();

    // 标签
    if (label) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px sans-serif";
      ctx.fillText(label, 8, 16);
    }
  }, [data, width, height, color, label]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, borderRadius: 8 }}
      className="w-full"
    />
  );
}
