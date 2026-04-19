# Demo 使用指南

声音克隆教学演示工具，面向中学生，分 5 步展示声音克隆完整流程。

## 目录

- [直接运行（开发/测试）](#直接运行)
- [打包为免安装应用](#打包为免安装应用)
- [分发生成物](#分发生成物)
- [常见问题](#常见问题)

## 直接运行

### 前置条件

- **Python 3.11 或 3.12**（⚠️ 不要使用 3.13+，ML 包如 kokoro/numba 不兼容）
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

- **Python 3.11 或 3.12**（⚠️ 3.13+ 会导致 ML 包安装失败或打包后崩溃）
- [Bun](https://bun.sh/)
- PyInstaller（包含在 `requirements.txt` 中，由 `just setup-python` 自动安装）
- **磁盘空间**：
  - 构建临时文件约 1-2 GB
  - 含模型 zip 约 7-8 GB
  - 不含模型 zip 约 400-500 MB
  - PyInstaller `--workpath` 和 pip 缓存默认在系统盘，如空间不足需设置环境变量（见下文）

**注意：PyInstaller 只能构建当前平台的二进制。Windows exe 必须在 Windows 上构建。**

### 环境准备

#### 1. 安装正确版本的 Python

Windows 上如果系统 Python 是 3.13+，需要安装 3.12：

```powershell
# 下载 Python 3.12 并安装到自定义目录（避免占用 C 盘）
# 从 https://www.python.org/downloads/ 下载 3.12.x 安装包
# 命令行静默安装到 F 盘：
Start-Process -Wait -FilePath "python-3.12.10-amd64.exe" `
  -ArgumentList "/quiet","InstallAllUsers=0","TargetDir=F:\Python312","PrependPath=0","Include_pip=1","Include_launcher=0"
```

#### 2. 用正确版本创建 venv 并安装依赖

```powershell
# 使用 Python 3.12 创建 venv（替换旧的 3.13+/3.14 venv）
F:\Python312\python.exe -m venv backend\venv

# 激活 venv
backend\venv\Scripts\Activate.ps1

# 安装依赖
pip install -r backend/requirements.txt
pip install --no-deps chatterbox-tts
pip install --no-deps hume-tada
pip install git+https://github.com/QwenLM/Qwen3-TTS.git
pip install pyinstaller ruff pytest pytest-asyncio
```

> **注意**：`requirements.txt` 中 `misaki[en,ja,zh]` 的 `ja` 依赖 `pyopenjtalk` 需要 C++ 编译器。
> 如果没有 Visual Studio Build Tools，可以只安装 `misaki[en,zh]`（跳过日语支持）。

#### 3. Windows C 盘空间不足的解决方案

PyInstaller 和 pip 默认使用 `%TEMP%`（C 盘）存放临时文件。如果 C 盘空间不足：

```powershell
# 设置临时目录和缓存到其他盘
$env:TMP = "F:\Temp"
$env:TEMP = "F:\Temp"
$env:HUGGINGFACE_HUB_CACHE = "F:\HF_Cache"

# 然后再运行构建命令
```

`just build-demo` 已内置这些环境变量设置，直接使用 `just` 命令即可。
`build_binary.py` 也已修改为在 Windows 上将 `--workpath` 指向 `F:\Temp\voicebox-build`。

### 命令

```bash
# 激活虚拟环境
source backend/venv/bin/activate  # macOS/Linux
backend\venv\Scripts\Activate.ps1  # Windows

# 方式一：打包 exe + 模型（zip 约 7-8GB，开箱即用）
python backend/build_binary.py --demo

# 方式二：只打 exe 不含模型（zip 约 400-500MB，用户自行准备模型）
python backend/build_binary.py --demo --no-model
```

或使用 just：

```bash
just build-demo        # 含模型
just build-demo-lite   # 不含模型
```

> **Windows 空间提示**：`just build-demo` 会自动将临时文件和 HuggingFace 缓存指向 F 盘。
> 如果你使用其他盘符，需要手动修改 `justfile` 中的路径。

### 构建产物

```
backend/dist/voicebox-demo.zip      ← 分发用压缩包
backend/dist/voicebox-demo/          ← 解压后的目录（可直接运行）
```

### 产物目录结构

```
voicebox-demo/
├── voicebox-demo(.exe)     ← 双击启动
├── voicebox-startup.log    ← 启动日志（用于排查问题，正常运行后可删除）
├── _internal/              ← 运行时依赖 + demo 前端
│   ├── demo_dist/
│   └── ...
└── models/                 ← 模型文件（--no-model 时无此目录）
    └── models--Qwen--Qwen3-TTS-12Hz-1.7B-Base/
        ├── blobs/
        └── snapshots/
```

### 排查启动问题

如果 exe 双击后没有反应（闪退），检查 exe 同目录下的 `voicebox-startup.log`：

```powershell
# 查看启动日志
type voicebox-startup.log
```

常见错误及解决方案：

| 错误信息 | 原因 | 解决 |
|---|---|---|
| `No module named 'xxx'` | PyInstaller 未收集该包 | 在 `build_binary.py` 中添加 `--hidden-import xxx` |
| `ModuleNotFoundError` | 依赖未安装到 venv | `pip install xxx` 后重新构建 |
| `Cannot load imports from non-existent stub` | librosa 的 lazy_loader 问题 | 在 `build_binary.py` 中添加 `--collect-all lazy_loader` |

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

### 运行相关

**Q: 启动后浏览器没有自动打开？**

手动访问 `http://127.0.0.1:17493/demo/`。

**Q: 提示模型找不到？**

检查 `models/` 目录是否在 exe 同级位置，目录结构是否正确。或去掉 `--demo` 让程序从默认 HuggingFace 缓存加载。

**Q: exe 双击后没反应/闪退？**

检查 exe 同目录的 `voicebox-startup.log` 文件，查看具体错误。最常见的原因是依赖缺失导致 Python 模块导入失败。

**Q: 语音合成很慢？**

CPU 推理较慢（1-3 分钟），属于正常现象。GPU 可大幅加速，但 demo 打包仅支持 CPU 模式。

### 打包相关

**Q: 打包时报 `demo/dist/` 不存在？**

先运行 `cd demo && bun install && bun run build` 构建前端。

**Q: Windows 上打包报 PyInstaller 找不到？**

确认已激活虚拟环境并安装依赖：`pip install pyinstaller`。完整安装步骤见[环境准备](#2-用正确版本创建-venv-并安装依赖)。

**Q: pip install 报 `pyopenjtalk` 编译失败？**

`misaki[ja]` 依赖 `pyopenjtalk`，需要 C++ 编译器。解决方案：
1. 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（选择 "Desktop development with C++"）
2. 或跳过日语支持，手动安装 `pip install "misaki[en,zh]>=0.9.4"` 替代 `misaki[en,ja,zh]`

**Q: Windows C 盘空间不足，打包失败？**

设置临时目录到其他盘：
```powershell
$env:TMP = "F:\Temp"
$env:TEMP = "F:\Temp"
$env:HUGGINGFACE_HUB_CACHE = "F:\HF_Cache"
```
或直接使用 `just build-demo`（已内置这些设置）。

**Q: 打包后 exe 启动报 `No module named 'xxx'`？**

PyInstaller 未自动收集该包。在 `backend/build_binary.py` 的 `args` 列表中添加：
- Python 模块：`"--hidden-import", "xxx"`
- 含数据文件的包：`"--collect-all", "xxx"`
- 含子模块的包：`"--collect-submodules", "xxx"`

然后重新构建。

**Q: Python 3.13/3.14 打包后 exe 崩溃？**

ML 包（kokoro、numba 等）不兼容 Python 3.13+。必须使用 Python 3.11 或 3.12 创建 venv：
```powershell
# 安装 Python 3.12 后重新创建 venv
F:\Python312\python.exe -m venv backend\venv
pip install -r backend/requirements.txt
# ... 然后重新构建
```

**Q: 网络代理导致 pip/spacy 下载失败？**

尝试清除代理设置：
```powershell
$env:HTTP_PROXY = ""
$env:HTTPS_PROXY = ""
pip install ... --timeout 120 --retries 5
```
