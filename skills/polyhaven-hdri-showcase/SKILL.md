---
name: polyhaven-hdri-showcase
description: Render the same product across multiple HDRI environments and output a comparison grid. Trigger when asked to compare lighting setups, test different environments, show product in multiple settings, or create an HDRI comparison.
---

# PolyHaven HDRI Showcase

Renders your product across multiple PolyHaven HDRI environments and saves each as an image — perfect for picking the best lighting for your product shots or creating a showcase grid.

## How to Run

These scripts need Node 18+ and talk to the blender-mcp add-on over its socket (default port 9876, change with `--port`). `<skill-dir>` is this skill's folder, shown when the skill loads. Quote paths: Windows paths often contain spaces. A leading `~` works in every shell.

```bash
node "<skill-dir>/scripts/polyhaven-hdri-showcase.js" --output "~/Videos/Blender Skills/hdri-compare"
node "<skill-dir>/scripts/polyhaven-hdri-showcase.js" --hdris "studio_small_09,royal_esplanade,industrial_sunset_02_puresky" --output "~/Videos/Blender Skills"
node "<skill-dir>/scripts/polyhaven-hdri-showcase.js" --preset studios --output "~/Videos/Blender Skills/studios"
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--output` | Output directory for rendered images | **required** |
| `--hdris` | Comma-separated HDRI IDs to compare | default set of 6 |
| `--preset` | HDRI set: studios, outdoor, dramatic, all | none |
| `--resolution` | HDRI resolution: 1k, 2k | `1k` |
| `--render-width` | Render image width | `1920` |
| `--render-height` | Render image height | `1080` |
| `--samples` | Render samples | `64` |
| `--port` | Blender MCP port | `9876` |
