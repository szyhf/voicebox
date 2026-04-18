const API_BASE = "";

const TAG = "[Demo API]";

export interface PreprocessResult {
  original_rms: number;
  normalized_rms: number;
  original_peak: number;
  normalized_peak: number;
  duration: number;
  sample_rate: number;
  original_waveform: number[];
  normalized_waveform: number[];
  processed_audio_path: string;
}

export interface SpectrogramResult {
  mel_spectrogram: number[][];
  n_mels: number;
  n_frames: number;
  hop_length: number;
}

export interface TensorInfo {
  key: string;
  shape: number[];
  values: number[];
  stats: { mean: number; std: number; min: number; max: number };
}

export interface EmbedResult {
  prompt_keys: string[];
  tensors: TensorInfo[];
}

export interface GenerateResult {
  audio_url: string;
  duration: number;
}

async function apiCall(name: string, url: string, options: RequestInit): Promise<Response> {
  console.log(`${TAG} 【${name}】请求开始`, url);
  console.log(`${TAG} 【${name}】请求参数`, options.body ? JSON.stringify(options.body).slice(0, 200) : "(无body)");
  const startTime = performance.now();

  try {
    const res = await fetch(url, options);
    const elapsed = Math.round(performance.now() - startTime);
    console.log(`${TAG} 【${name}】响应状态: ${res.status} ${res.statusText}，耗时: ${elapsed}ms`);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`${TAG} 【${name}】请求失败: ${res.status}`, errText);
      throw new Error(`${name}失败(${res.status}): ${errText}`);
    }
    return res;
  } catch (e) {
    const elapsed = Math.round(performance.now() - startTime);
    console.error(`${TAG} 【${name}】网络异常，耗时: ${elapsed}ms`, e);
    throw e;
  }
}

export async function uploadAudio(file: File): Promise<string> {
  console.log(`${TAG} 【上传音频】文件名: ${file.name}，大小: ${(file.size / 1024).toFixed(1)}KB，类型: ${file.type}`);
  const form = new FormData();
  form.append("file", file);
  const res = await apiCall("上传音频", `${API_BASE}/demo/upload`, { method: "POST", body: form });
  const data = await res.json();
  console.log(`${TAG} 【上传音频】成功，服务端路径: ${data.audio_path}`);
  return data.audio_path as string;
}

export async function preprocess(audioPath: string): Promise<PreprocessResult> {
  console.log(`${TAG} 【音频预处理】输入路径: ${audioPath}`);
  const res = await apiCall("音频预处理", `${API_BASE}/demo/preprocess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio_path: audioPath }),
  });
  const data: PreprocessResult = await res.json();
  console.log(`${TAG} 【音频预处理】完成，时长: ${data.duration.toFixed(1)}s，原始波形点数: ${data.original_waveform.length}，归一化波形点数: ${data.normalized_waveform.length}，RMS: ${data.original_rms.toFixed(4)} → ${data.normalized_rms.toFixed(4)}`);
  return data;
}

export async function spectrogram(audioPath: string): Promise<SpectrogramResult> {
  console.log(`${TAG} 【频谱分析】输入路径: ${audioPath}`);
  const res = await apiCall("频谱分析", `${API_BASE}/demo/spectrogram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio_path: audioPath }),
  });
  const data: SpectrogramResult = await res.json();
  console.log(`${TAG} 【频谱分析】完成，矩阵: ${data.n_mels}×${data.n_frames}，总数据点: ${data.n_mels * data.n_frames}`);
  return data;
}

export async function embed(audioPath: string, referenceText: string): Promise<EmbedResult> {
  console.log(`${TAG} 【声纹提取】输入路径: ${audioPath}，参考文本: "${referenceText.slice(0, 30)}..."`);
  const res = await apiCall("声纹提取", `${API_BASE}/demo/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio_path: audioPath, reference_text: referenceText }),
  });
  const data: EmbedResult = await res.json();
  console.log(`${TAG} 【声纹提取】完成，字段数: ${data.prompt_keys.length}，tensor数: ${data.tensors.length}`);
  data.tensors.forEach((t) => {
    console.log(`  - ${t.key}: shape=[${t.shape}] 均值=${t.stats.mean.toFixed(3)} 标准差=${t.stats.std.toFixed(3)}`);
  });
  return data;
}

export async function generate(
  text: string,
  audioPath: string,
  referenceText: string,
  onProgress: (phase: string, progress: number) => void,
  effects?: { pitch: number; reverb: number; gain: number }
): Promise<GenerateResult> {
  console.log(`${TAG} 【语音合成】文本: "${text.slice(0, 30)}..."，音频: ${audioPath}`);
  if (effects) {
    console.log(`${TAG} 【语音合成】音效参数: 变调=${effects.pitch} 混响=${effects.reverb}% 增益=${effects.gain}dB`);
  }

  // Simulate phase progress while waiting for the server
  const phases = [
    { name: "loading_model", label: "加载 AI 模型", start: 0, end: 20, duration: 3000 },
    { name: "creating_prompt", label: "提取声纹特征", start: 20, end: 35, duration: 3000 },
    { name: "generating", label: "生成语音中", start: 35, end: 90, duration: 120000 },
    { name: "saving", label: "编码音频文件", start: 90, end: 100, duration: 2000 },
  ];

  const startTime = Date.now();
  const timer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    let accDuration = 0;
    for (const phase of phases) {
      accDuration += phase.duration;
      if (elapsed < accDuration) {
        const phaseElapsed = elapsed - (accDuration - phase.duration);
        const phaseProgress = Math.min(phaseElapsed / phase.duration, 1);
        const progress = phase.start + (phase.end - phase.start) * phaseProgress;
        onProgress(phase.name, Math.min(progress, 95));
        return;
      }
    }
    onProgress("generating", 95);
  }, 500);

  try {
    const res = await apiCall("语音合成", `${API_BASE}/demo/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, audio_path: audioPath, reference_text: referenceText, effects }),
    });
    const data: GenerateResult = await res.json();
    clearInterval(timer);
    onProgress("done", 100);
    console.log(`${TAG} 【语音合成】完成，音频URL: ${data.audio_url}，时长: ${data.duration.toFixed(1)}s`);
    return data;
  } catch (e) {
    clearInterval(timer);
    throw e;
  }
}

export function audioUrl(path: string): string {
  const filename = path.split("/").pop();
  const url = `${API_BASE}/demo/audio/${filename}`;
  console.log(`${TAG} 【音频URL】生成: ${url}`);
  return url;
}
