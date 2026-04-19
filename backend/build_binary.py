"""
PyInstaller build script for creating standalone Python server binary.

Usage:
    python build_binary.py           # Build default (CPU) server binary
    python build_binary.py --cuda    # Build CUDA-enabled server binary
    python build_binary.py --demo    # Build demo binary (onedir + bundled model)
"""

import PyInstaller.__main__
import argparse
import logging
import os
import platform
import sys
from pathlib import Path

logger = logging.getLogger(__name__)


def is_apple_silicon():
    """Check if running on Apple Silicon."""
    return platform.system() == "Darwin" and platform.machine() == "arm64"


def build_server(cuda=False, demo=False, demo_no_model=False):
    """Build Python server as standalone binary.

    Args:
        cuda: If True, build with CUDA support and name the binary
              voicebox-server-cuda instead of voicebox-server.
        demo: If True, build demo mode: onedir, include demo frontend,
              copy model files, and create zip archive.
        demo_no_model: If True with --demo, skip copying model files.
    """
    backend_dir = Path(__file__).parent
    project_root = backend_dir.parent

    if demo:
        binary_name = "voicebox-demo"
    elif cuda:
        binary_name = "voicebox-server-cuda"
    else:
        binary_name = "voicebox-server"

    # CUDA builds and demo builds use --onedir; CPU builds remain --onefile.
    pack_mode = "--onedir" if (cuda or demo) else "--onefile"
    args = [
        "server.py",  # Use server.py as entry point instead of main.py
        pack_mode,
        "--name",
        binary_name,
    ]

    # Hide console window on Windows for non-demo builds.
    # Demo builds keep the console visible so users can see logs for debugging.
    # On macOS/Linux the sidecar needs stdout/stderr for Tauri to capture logs.
    if platform.system() == "Windows" and not demo:
        args.append("--noconsole")

    # numpy 2.x / torch ABI mismatch fix: install memmove fallback for
    # torch.from_numpy() before the app starts. Runtime hooks run after
    # FrozenImporter is registered so frozen torch/numpy are importable.
    # Paths are passed relative to backend_dir because os.chdir(backend_dir)
    # runs before PyInstaller. Absolute paths would get baked into the
    # generated .spec, breaking reproducible builds on other machines / CI.
    args.extend(
        [
            "--runtime-hook",
            "pyi_rth_numpy_compat.py",
            # Stub torch.compiler.disable before transformers imports
            # flex_attention, which otherwise triggers torch._dynamo →
            # torch._numpy._ufuncs and crashes at module load under
            # PyInstaller. See pyi_rth_torch_compiler_disable.py.
            "--runtime-hook",
            "pyi_rth_torch_compiler_disable.py",
            # Per-module collection overrides (e.g. forcing scipy.stats._distn_infrastructure
            # to bundle .py source alongside .pyc so the runtime hook can source-patch it).
            "--additional-hooks-dir",
            "pyi_hooks",
        ]
    )

    # Add local qwen_tts path if specified (for editable installs)
    qwen_tts_path = os.getenv("QWEN_TTS_PATH")
    if qwen_tts_path and Path(qwen_tts_path).exists():
        args.extend(["--paths", str(qwen_tts_path)])
        logger.info("Using local qwen_tts source from: %s", qwen_tts_path)

    # Add common hidden imports
    args.extend(
        [
            "--hidden-import",
            "backend",
            "--hidden-import",
            "backend.main",
            "--hidden-import",
            "backend.config",
            "--hidden-import",
            "backend.database",
            "--hidden-import",
            "backend.models",
            "--hidden-import",
            "backend.services.profiles",
            "--hidden-import",
            "backend.services.history",
            "--hidden-import",
            "backend.services.tts",
            "--hidden-import",
            "backend.services.transcribe",
            "--hidden-import",
            "backend.utils.platform_detect",
            "--hidden-import",
            "backend.backends",
            "--hidden-import",
            "backend.backends.pytorch_backend",
            "--hidden-import",
            "backend.backends.qwen_custom_voice_backend",
            "--hidden-import",
            "backend.utils.audio",
            "--hidden-import",
            "backend.utils.cache",
            "--hidden-import",
            "backend.utils.progress",
            "--hidden-import",
            "backend.utils.hf_progress",
            "--hidden-import",
            "backend.services.cuda",
            "--hidden-import",
            "backend.services.effects",
            "--hidden-import",
            "backend.utils.effects",
            "--hidden-import",
            "backend.services.versions",
            "--hidden-import",
            "pedalboard",
            "--hidden-import",
            "chatterbox",
            "--hidden-import",
            "chatterbox.tts_turbo",
            "--hidden-import",
            "chatterbox.mtl_tts",
            "--hidden-import",
            "backend.backends.chatterbox_backend",
            "--hidden-import",
            "backend.backends.chatterbox_turbo_backend",
            # chatterbox multilingual uses spacy_pkuseg for Chinese word
            # segmentation, which ships pickled dict files (dicts/default.pkl)
            # and native .so extensions that --hidden-import alone won't bundle.
            "--collect-all",
            "spacy_pkuseg",
            "--hidden-import",
            "backend.backends.luxtts_backend",
            "--hidden-import",
            "zipvoice",
            "--hidden-import",
            "zipvoice.luxvoice",
            "--collect-all",
            "zipvoice",
            "--collect-all",
            "linacodec",
            "--hidden-import",
            "torch",
            "--hidden-import",
            "transformers",
            "--hidden-import",
            "fastapi",
            "--hidden-import",
            "uvicorn",
            "--hidden-import",
            "sqlalchemy",
            # librosa uses lazy_loader which generates .pyi stub files at
            # install time and reads them at runtime to discover submodules.
            # --hidden-import alone doesn't bundle the stubs, causing
            # "Cannot load imports from non-existent stub" at runtime.
            "--collect-all",
            "lazy_loader",
            "--collect-all",
            "librosa",
            "--hidden-import",
            "soundfile",
            "--hidden-import",
            "qwen_tts",
            "--hidden-import",
            "qwen_tts.inference",
            "--hidden-import",
            "qwen_tts.inference.qwen3_tts_model",
            "--hidden-import",
            "qwen_tts.inference.qwen3_tts_tokenizer",
            "--hidden-import",
            "qwen_tts.core",
            "--hidden-import",
            "qwen_tts.cli",
            "--copy-metadata",
            "qwen-tts",
            "--copy-metadata",
            "requests",
            "--copy-metadata",
            "transformers",
            "--copy-metadata",
            "huggingface-hub",
            "--copy-metadata",
            "tokenizers",
            "--copy-metadata",
            "safetensors",
            "--copy-metadata",
            "tqdm",
            "--hidden-import",
            "requests",
            # qwen_tts uses inspect.getsource() at runtime to locate
            # modeling_qwen3_tts.py — needs physical .py source files bundled
            "--collect-all",
            "qwen_tts",
            # Fix for pkg_resources and jaraco namespace packages
            "--hidden-import",
            "pkg_resources.extern",
            "--collect-submodules",
            "jaraco",
            # inflect uses typeguard @typechecked which calls inspect.getsource()
            # at import time — needs .py source files, not just .pyc bytecode
            "--collect-all",
            "inflect",
            # perth ships pretrained watermark model files (hparams.yaml, .pth.tar)
            # in perth/perth_net/pretrained/ — needed by chatterbox at runtime
            "--collect-all",
            "perth",
            # piper_phonemize ships espeak-ng-data/ (phoneme tables, language dicts)
            # needed by LuxTTS for text-to-phoneme conversion
            "--collect-all",
            "piper_phonemize",
            # HumeAI TADA — speech-language model using Llama + flow matching
            "--hidden-import",
            "backend.backends.hume_backend",
            "--hidden-import",
            "tada",
            "--hidden-import",
            "tada.modules",
            "--hidden-import",
            "tada.modules.tada",
            "--hidden-import",
            "tada.modules.encoder",
            "--hidden-import",
            "tada.modules.decoder",
            "--hidden-import",
            "tada.modules.aligner",
            "--hidden-import",
            "tada.modules.acoustic_spkr_verf",
            "--hidden-import",
            "tada.nn",
            "--hidden-import",
            "tada.nn.vibevoice",
            "--hidden-import",
            "tada.utils",
            "--hidden-import",
            "tada.utils.gray_code",
            "--hidden-import",
            "tada.utils.text",
            # DAC shim — provides dac.nn.layers.Snake1d without the real
            # descript-audio-codec package (which pulls onnx/tensorboard via
            # descript-audiotools). The shim is in backend/utils/dac_shim.py.
            "--hidden-import",
            "backend.utils.dac_shim",
            "--hidden-import",
            "torchaudio",
            "--collect-submodules",
            "tada",
            # Kokoro 82M — lightweight TTS engine using misaki G2P
            # collect-all is required because transformers introspects .py source
            # files at runtime (e.g. _can_set_attn_implementation opens the class
            # file); hidden-import alone only bundles bytecode.
            "--hidden-import",
            "backend.backends.kokoro_backend",
            "--collect-all",
            "kokoro",
            # misaki ships G2P data files (dictionaries, phoneme tables)
            # that must be bundled for espeak/en/ja/zh G2P to work
            "--collect-all",
            "misaki",
            # language_tags ships JSON data files (index.json etc.) loaded at
            # runtime via: misaki → phonemizer → segments → csvw → language_tags
            "--collect-all",
            "language_tags",
            # espeakng_loader ships the entire espeak-ng-data directory (369 files)
            # loaded at import time by misaki.espeak via get_data_path()
            "--collect-all",
            "espeakng_loader",
            # spacy en_core_web_sm model — misaki.en tries to spacy.cli.download()
            # at runtime if not found, which calls pip as a subprocess and crashes
            # the frozen binary. Bundle the model so spacy.util.is_package() passes.
            "--collect-all",
            "en_core_web_sm",
            "--copy-metadata",
            "en_core_web_sm",
            "--hidden-import",
            "en_core_web_sm",
            "--hidden-import",
            "loguru",
        ]
    )

    # Add CUDA-specific hidden imports
    if cuda:
        logger.info("Building with CUDA support")
        args.extend(
            [
                "--hidden-import",
                "torch.cuda",
                "--hidden-import",
                "torch.backends.cudnn",
            ]
        )
    else:
        # Exclude NVIDIA CUDA packages from CPU-only builds to keep binary small.
        # When building from a venv with CUDA torch installed, PyInstaller would
        # bundle ~3GB of NVIDIA shared libraries. We exclude both the Python
        # modules and the binary DLLs.
        nvidia_packages = [
            "nvidia",
            "nvidia.cublas",
            "nvidia.cuda_cupti",
            "nvidia.cuda_nvrtc",
            "nvidia.cuda_runtime",
            "nvidia.cudnn",
            "nvidia.cufft",
            "nvidia.curand",
            "nvidia.cusolver",
            "nvidia.cusparse",
            "nvidia.nccl",
            "nvidia.nvjitlink",
            "nvidia.nvtx",
        ]
        for pkg in nvidia_packages:
            args.extend(["--exclude-module", pkg])

    # Add MLX-specific imports if building on Apple Silicon (never for CUDA builds)
    if is_apple_silicon() and not cuda:
        logger.info("Building for Apple Silicon - including MLX dependencies")
        args.extend(
            [
                "--hidden-import",
                "backend.backends.mlx_backend",
                "--hidden-import",
                "mlx",
                "--hidden-import",
                "mlx.core",
                "--hidden-import",
                "mlx.nn",
                "--hidden-import",
                "mlx_audio",
                "--hidden-import",
                "mlx_audio.tts",
                "--hidden-import",
                "mlx_audio.stt",
                "--collect-submodules",
                "mlx",
                "--collect-submodules",
                "mlx_audio",
                # Use --collect-all so PyInstaller bundles both data files AND
                # native shared libraries (.dylib, .metallib) for MLX.
                # Previously only --collect-data was used, which caused MLX to
                # raise OSError at runtime inside the bundled binary because
                # the Metal shader libraries were missing.
                "--collect-all",
                "mlx",
                "--collect-all",
                "mlx_audio",
            ]
        )
    elif not cuda:
        logger.info("Building for non-Apple Silicon platform - PyTorch only")

    # Demo mode: include demo frontend static files
    if demo:
        demo_dist = project_root / "demo" / "dist"
        if demo_dist.is_dir():
            args.extend(["--add-data", f"{demo_dist}{os.pathsep}demo_dist"])
            logger.info("Demo mode: including demo frontend from %s", demo_dist)
        else:
            logger.error("Demo mode requires demo/dist/ — run 'cd demo && bun run build' first")
            sys.exit(1)

    dist_dir = str(backend_dir / "dist")
    # Use F drive for build temp files to avoid C drive space issues on Windows
    if platform.system() == "Windows":
        import tempfile
        build_base = Path("F:/Temp/voicebox-build")
        build_base.mkdir(parents=True, exist_ok=True)
        # Use a unique subdirectory for this build
        import uuid
        build_dir = str(build_base / str(uuid.uuid4())[:8])
    else:
        build_dir = str(backend_dir / "build")

    args.extend(
        [
            "--distpath",
            dist_dir,
            "--workpath",
            build_dir,
            "--noconfirm",
            "--clean",
        ]
    )

    # Change to backend directory
    os.chdir(backend_dir)

    # For CPU builds on Windows, ensure we're using CPU-only torch.
    # If CUDA torch is installed (local dev), swap to CPU torch before building,
    # then restore CUDA torch after. This prevents PyInstaller from bundling
    # ~3GB of CUDA DLLs into the CPU binary.
    restore_cuda = False
    if not cuda and platform.system() == "Windows":
        import subprocess

        result = subprocess.run(
            [sys.executable, "-c", "import torch; print(torch.version.cuda or '')"], capture_output=True, text=True
        )
        has_cuda_torch = bool(result.stdout.strip())
        if has_cuda_torch:
            logger.info("CUDA torch detected — installing CPU torch for CPU build...")
            subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "pip",
                    "install",
                    "torch",
                    "torchvision",
                    "torchaudio",
                    "--index-url",
                    "https://download.pytorch.org/whl/cpu",
                    "--force-reinstall",
                    "-q",
                ],
                check=True,
            )
            restore_cuda = True

    # Run PyInstaller
    try:
        PyInstaller.__main__.run(args)
    finally:
        # Restore CUDA torch if we swapped it out (even on build failure)
        if restore_cuda:
            logger.info("Restoring CUDA torch...")
            import subprocess

            subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "pip",
                    "install",
                    "torch",
                    "torchvision",
                    "torchaudio",
                    "--index-url",
                    "https://download.pytorch.org/whl/cu128",
                    "--force-reinstall",
                    "-q",
                ],
                check=True,
            )

    logger.info("Binary built in %s", backend_dir / "dist" / binary_name)

    # Demo post-build: create zip (with or without model)
    if demo:
        _package_demo(backend_dir / "dist" / binary_name, include_model=not demo_no_model)


def _package_demo(output_dir: Path, include_model: bool = True) -> None:
    """Create a zip archive of the demo distribution.

    Args:
        output_dir: The onedir output directory from PyInstaller.
        include_model: If True, copy Qwen3-TTS model into the distribution.
    """
    import shutil

    if include_model:
        models_src = _find_qwen_model_cache()
        models_dst = output_dir / "models"

        if models_src:
            models_dst.mkdir(parents=True, exist_ok=True)
            dst_repo = models_dst / models_src.name
            if dst_repo.exists():
                shutil.rmtree(dst_repo)
            shutil.copytree(models_src, dst_repo)
            logger.info("Demo: copied model from %s to %s", models_src, dst_repo)
        else:
            logger.warning(
                "Demo: Qwen3-TTS model not found in HF cache. "
                "The zip will not include model files — users must download separately."
            )
    else:
        logger.info("Demo: skipping model (--no-model flag)")

    # Create zip archive
    zip_name = "voicebox-demo"
    logger.info("Demo: creating zip archive %s.zip ...", zip_name)
    shutil.make_archive(
        base_name=str(output_dir.parent / zip_name),
        format="zip",
        root_dir=str(output_dir),
    )
    zip_path = output_dir.parent / f"{zip_name}.zip"
    size_mb = zip_path.stat().st_size / (1024 * 1024)
    logger.info("Demo: zip created at %s (%.0f MB)", zip_path, size_mb)


def _find_qwen_model_cache() -> Path | None:
    """Locate the Qwen3-TTS 1.7B model in the HuggingFace Hub cache."""
    from huggingface_hub import constants as hf_constants

    cache_dir = Path(hf_constants.HF_HUB_CACHE)
    # Try the standard PyTorch model ID
    for repo_name in ["Qwen--Qwen3-TTS-12Hz-1.7B-Base", "Qwen--Qwen3-TTS-1.7B"]:
        repo_dir = cache_dir / f"models--{repo_name}"
        if repo_dir.is_dir():
            return repo_dir
    return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build voicebox-server binary")
    parser.add_argument(
        "--cuda",
        action="store_true",
        help="Build CUDA-enabled binary (voicebox-server-cuda)",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Build demo binary (onedir + demo frontend + zip)",
    )
    parser.add_argument(
        "--no-model",
        action="store_true",
        dest="no_model",
        help="With --demo, skip bundling model files (users provide their own)",
    )
    cli_args = parser.parse_args()
    build_server(cuda=cli_args.cuda, demo=cli_args.demo, demo_no_model=cli_args.no_model)
