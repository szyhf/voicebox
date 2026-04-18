interface Props {
  src: string;
  label?: string;
}

export default function AudioPlayer({ src, label }: Props) {
  return (
    <div className="flex items-center gap-3 bg-slate-700/50 rounded-lg px-4 py-3">
      {label && <span className="text-sm text-slate-400">{label}</span>}
      <audio controls src={src} className="h-8 w-full" />
    </div>
  );
}
