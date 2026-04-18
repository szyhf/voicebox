# Demo 使用指南

声音克隆教学演示工具，面向中学生，分 5 步展示声音克隆完整流程。

## 目录

- [直接运行（开发/测试）](#直接运行)
- [打包为免安装应用](#打包为免安装应用)
- [分发生成物](#分发生成物)
- [常见问题](#常见问题)

## 直接运行

### 前置条件

- Python 3.11+
- [Bun](https://bun.sh/)（JS 包管理）
- Qwen3-TTS 1.7B 模型（首次运行会自动下载到 `~/.cache/huggingface/hub/`）

### 步骤

```bash
# 1. 安装 Python 依赖（仅需一次）
python -m venv backend/venv
# macOS/Linux:
source backend/venv/bin/activate
# Windows PowerShell:
backend\venv\Scripts\Activate.ps1

pip install -r requirements.txt

# 2. 构建 demo 前端
cd demo && bun install && bun run build && cd ..

# 3. 启动服务（自动打开浏览器）
python -m backend.server --demo --port 17493
```

启动后浏览器自动打开 `http://127.0.0.1:17493/demo/`。

### 开发模式（前后端分离，支持热更新）

```bash
# 终端 1：启动后端
python -m backend.server --port 17493

# 终端 2：启动前端开发服务器（端口 5174，自动代理到后端）
cd demo && bun dev
```

开发模式下访问 `http://localhost:5174`，前端改动实时刷新。

## 打包为免安装应用

### 前置条件

同上，另需 PyInstaller（已包含在 requirements.txt 中）。

**注意：PyInstaller 只能构建当前平台的二进制。Windows exe 必须在 Windows 上构建。**

### 命令

```bash
# 激活虚拟环境
source backend/venv/bin/activate  # macOS/Linux
backend\venv\Scripts\Activate.ps1  # Windows

# 方式一：打包 exe + 模型（zip 约 7-8GB，开箱即用）
python backend/build_binary.py --demo

# 方式二：只打 exe 不含模型（zip 约 1-2GB，用户自行准备模型）
python backend/build_binary.py --demo --no-model
```

或使用 just：

```bash
just build-demo        # 含模型
just build-demo-lite   # 不含模型
```

### 产物

```
backend/dist/voicebox-demo.zip
```

### 产物目录结构

```
voicebox-demo/
├── voicebox-demo(.exe)     ← 双击启动
├── _internal/              ← 运行时依赖 + demo 前端
│   ├── demo_dist/
│   └── ...
└── models/                 ← 模型文件（--no-model 时无此目录）
    └── models--Qwen--Qwen3-TTS-12Hz-1.7B-Base/
        ├── blobs/
        └── snapshots/
```

## 分发生成物

### 含模型的 zip（`--demo`）

直接把 zip 发给用户：

1. 解压到任意目录
2. 双击 `voicebox-demo.exe`
3. 浏览器自动打开，直接使用

### 不含模型的 zip（`--demo --no-model`）

需要额外准备模型文件：

1. 解压 zip 到目标目录
2. 在 exe 同级目录创建 `models/` 文件夹
3. 将模型文件复制到 `models/` 下：

```
models/
└── models--Qwen--Qwen3-TTS-12Hz-1.7B-Base/
    ├── blobs/           ← 模型权重
    ├── refs/            ← 引用指针
    └── snapshots/       ← 快照
```

模型文件来源：
- 从已下载的机器上复制 `~/.cache/huggingface/hub/models--Qwen--Qwen3-TTS-12Hz-1.7B-Base/`
- 或使用 `huggingface-cli download Qwen/Qwen3-TTS-12Hz-1.7B-Base` 下载

**模型文件跨平台通用**，macOS 下载的可直接用于 Windows。

4. 双击 `voicebox-demo.exe` 启动

## 常见问题

**Q: 启动后浏览器没有自动打开？**

手动访问 `http://127.0.0.1:17493/demo/`。

**Q: 提示模型找不到？**

检查 `models/` 目录是否在 exe 同级位置，目录结构是否正确。或去掉 `--demo` 让程序从默认 HuggingFace 缓存加载。

**Q: 打包时报 `demo/dist/` 不存在？**

先运行 `cd demo && bun install && bun run build` 构建前端。

**Q: Windows 上打包报 PyInstaller 找不到？**

确认已激活虚拟环境并安装依赖：`pip install -r requirements.txt`。

**Q: 语音合成很慢？**

CPU 推理较慢（1-3 分钟），属于正常现象。GPU 可大幅加速，但 demo 打包仅支持 CPU 模式。
