# Voicebox 项目指南

## 项目概述

Voicebox 是一个开源的本地声音克隆工作室，支持 5 个 TTS 引擎、23 种语言、后期音效处理、多轨时间线编辑。版本 0.4.0，MIT 许可。

## 项目结构

```
voicebox/
├── app/              # 共享 React 前端（桌面 + web）
├── tauri/            # Tauri 桌面应用（Rust）
├── web/              # Web 部署前端（复用 app/ 代码，@/ alias 指向 app/src）
├── backend/          # Python FastAPI 后端
│   ├── routes/       #   API 路由（按领域拆分）
│   ├── services/     #   业务逻辑（生成、档案、任务队列等）
│   ├── backends/     #   TTS/STT 引擎后端（统一协议）
│   ├── database/     #   SQLAlchemy 数据库
│   ├── utils/        #   音频处理、缓存、进度追踪等工具
│   └── models.py     #   Pydantic 请求/响应模型
├── demo/             # 教学演示 Web 应用（独立前端 + 复用后端 API）
├── landing/          # 营销网站
├── docs/             # 文档源码 + 教学文档
└── scripts/          # 构建/发布脚本
```

## 技术栈

- 前端：React 18 + TypeScript + Tailwind CSS v4 + Zustand + TanStack Query
- 桌面：Tauri v2 (Rust)，替代 Electron
- 后端：Python 3.11+ / FastAPI / SQLAlchemy / SQLite
- AI 框架：PyTorch (CUDA/DirectML/XPU) 或 MLX (Apple Silicon)
- 包管理：Bun（JS）、pip/uv（Python）
- 构建：Vite、just（任务运行器）

## 开发命令

```bash
just setup           # 初始化 Python venv + 安装依赖
just dev             # 启动后端 + Tauri 桌面应用
just dev:server      # 仅启动后端 (uvicorn, port 17493)

# Web 前端
cd web && bun dev    # http://localhost:5173

# 教学演示
cd demo && bun dev   # http://localhost:5174

# 构建
just build           # 构建服务端二进制 + Tauri 应用
```

## 后端约定

### API 路由
- 每个领域一个文件：`backend/routes/{domain}.py`
- 使用 `router = APIRouter()`，在 `backend/routes/__init__.py` 注册
- 请求/响应模型统一定义在 `backend/models.py`
- 命名约定：`FooCreate`（创建请求）、`FooResponse`（响应）、`FooListResponse`（列表响应）
- 错误处理：业务逻辑抛 `ValueError`，路由层捕获转 `HTTPException(400, ...)`
- 数据库：`db: Session = Depends(get_db)`

### TTS 引擎后端
- 所有引擎实现 `TTSBackend` 协议（`backend/backends/__init__.py`）
- 统一接口：`load_model()`、`create_voice_prompt()`、`generate()`、`unload_model()`
- 通过 `get_tts_backend_for_engine(engine_name)` 获取实例
- 支持的引擎：qwen, qwen_custom_voice, luxtts, chatterbox, chatterbox_turbo, tada, kokoro

### 音频处理
- `backend/utils/audio.py`：`load_audio()`（重采样到 24kHz）、`normalize_audio()`（RMS 归一化）、`save_audio()`（原子写入）
- `backend/utils/effects.py`：基于 Spotify Pedalboard 的音效链
- `backend/utils/chunked_tts.py`：长文本分句 + 交叉淡入淡出拼接

### 模型缓存
- HuggingFace Hub 缓存在 `~/.cache/huggingface/hub/`
- `is_model_cached()` 检查模型是否已下载
- 声纹提示缓存：内存 + 磁盘两级，键为 MD5(音频字节 + 文本)

## 前端约定

- `@/` alias 指向 `app/src/`（web 和 demo 的 vite.config.ts 都这样配置）
- UI 组件：shadcn/ui 模式（Radix UI + CVA + tailwind-merge）
- API 客户端：`app/src/lib/api/client.ts`，base URL 从 Zustand store 读取
- 平台抽象：`app/src/platform/types.ts` 定义 Platform 接口，Tauri 和 Web 各自实现

## 教学演示（demo/）

面向中学生的声音克隆教学工具，分 6 步展示完整流程。固定使用 Qwen3-TTS 引擎。

- 前端：`demo/` 目录，React + Vite，端口 5174
- 后端 API：`backend/routes/demo.py`，前缀 `/demo/`
- 5 个端点：upload、preprocess、spectrogram、embed、generate
- 可视化：波形图、梅尔频谱热力图、声纹向量柱状图、音效滑块

## 教学文档

- `docs/voice-cloning-guide.md`：声音克隆技术原理与项目解析（面向教学）
