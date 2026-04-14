# Third Party Notices

本文档用于说明 `M3U8 Quicker` 在 `FFmpeg` 相关能力上的第三方组件、默认来源与许可证边界。

本文档不是法律意见。如你计划对外发布桌面安装包、企业内部分发版本或任何包含 `FFmpeg` 下载引导的商业版本，建议结合实际发布方式再次核对上游页面、对应源码与许可证文本。

## 1. 本仓库源码许可证

除另有说明外，本仓库自身源码采用 `Apache License 2.0`，详见根目录 `LICENSE`。

这一定义仅覆盖本仓库中的源码与随仓库直接提交的文件，不自动覆盖用户运行时使用、配置或下载的第三方 `FFmpeg` 二进制。

## 2. FFmpeg 在本项目中的集成方式

本项目的 `FFmpeg` 相关功能主要包括：

- FFmpeg工具：视频分析、格式/编码转换、合并视频、多音轨 HLS 合并
- 开始FFmpeg时优先使用FFmpeg对ts转mp4，未开启则使用内置算法转mp4

当前实现中，应用会按以下顺序寻找可用的 `FFmpeg`：

1. 用户在应用中手动指定的 `FFmpeg` 路径
2. 应用数据目录中的托管副本
3. 系统 `PATH` 中已安装的 `FFmpeg`

如果用户在应用内主动触发“下载 FFmpeg”，桌面端会通过 Rust 依赖 `ffmpeg-sidecar` 下载对应平台的第三方 `FFmpeg` 二进制到应用数据目录。相关逻辑位于：

- `src-tauri/src/ffmpeg.rs`
- `src-tauri/Cargo.toml`

## 3. FFmpeg 许可证边界

`FFmpeg` 项目本身并非 `Apache-2.0` 软件。

根据 `FFmpeg` 官方说明：

- `FFmpeg` 基础项目通常以 `LGPL v2.1 or later` 提供
- 若构建启用了 GPL 组件或某些外部库，则整个构建可能转为 `GPL v2+` 或 `GPL v3`

因此，本项目运行时使用的 `FFmpeg` 二进制，必须以“该二进制本身的上游许可证”为准，而不能简单视为随本仓库一起变成 `Apache-2.0`。

## 4. 当前默认下载来源

本项目当前使用的 `ffmpeg-sidecar` 默认下载地址来自其上游实现；不同平台对应的默认来源不同。

截至当前仓库依赖版本，默认来源为：

- Windows: `https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip`
- Linux x64: `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz`
- Linux arm64: `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz`
- macOS Intel: `https://evermeet.cx/ffmpeg/getrelease/zip`
- macOS Apple Silicon: `https://www.osxexperts.net/ffmpeg80arm.zip`

这些下载产物均为第三方发布的预编译二进制，其许可证、构建选项、是否包含 GPL 组件、对应源码提供方式，均以各自上游发布页或源码页为准。

## 5. 当前应当如何理解合规边界

对本项目而言，建议按以下方式理解：

- 本仓库源码仍然可以保持 `Apache-2.0`
- `FFmpeg` 相关二进制应视为独立第三方组件，不应在文档中表述为“整体都受 Apache-2.0 约束”
- 如果应用引导用户下载或使用第三方 `FFmpeg`，发布说明中应明确提示该组件适用其自身许可证
- 如果将来把 `FFmpeg` 二进制直接预置进安装包、便携版或镜像分发物，还需要按对应上游许可证补充更完整的源码提供、构建说明和分发声明

## 6. 当前仓库建议保留的说明

为避免歧义，项目文档应保持以下原则：

- 将“本仓库源码许可证”与“运行时第三方二进制许可证”分开表述
- 对 `FFmpeg` 使用“第三方组件”“上游许可证”这类措辞
- 不把下载得到的 `FFmpeg` 直接描述成“本项目 Apache-2.0 的一部分”

## 7. 相关上游项目与页面

### 本项目直接依赖

- `ffmpeg-sidecar`：MIT License
- 项目仓库：`https://github.com/nathanbabcock/ffmpeg-sidecar`
- crates.io 页面：`https://crates.io/crates/ffmpeg-sidecar`

### FFmpeg 官方

- `FFmpeg` 官方项目：`https://ffmpeg.org/`
- 法律与许可证说明：`https://ffmpeg.org/legal.html`

### 默认下载来源

- Gyan Windows builds：`https://www.gyan.dev/ffmpeg/builds/`
- John Van Sickle Linux builds：`https://johnvansickle.com/ffmpeg/`
- Evermeet macOS builds：`https://evermeet.cx/ffmpeg/`
- OSXExperts macOS Apple Silicon builds：`https://www.osxexperts.net/`
