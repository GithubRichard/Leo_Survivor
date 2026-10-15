# 扩展素材全集

根据 `数值与内容扩展方案.md` v1.1 制作，用户授权范围为全部新增素材。视觉方案见上级 `扩展美术设计.md`。

- `preview.html`：分类、搜索、背景切换与原图查看。
- `model-review.html`：敌人四向前摇、门开关、陷阱命中、植物生长与建筑屋顶对照。
- `prompts-enemy-*.json`：强化敌人轮廓后的修订提示词，最终合并到主清单。
- `prompts.json`：全部146项素材的名称、状态、朝向、依赖、描述与提示词；使用内置 image_gen 逐项生成。
- `generation-log.jsonl`：逐次生成来源与保存记录；`provenance.json`以SHA-256核对全部最终PNG的原生来源。
- `manifest.json`：实际交付项、尺寸、可见范围、透明背景检查及原素材复用引用。
- `validation.json`：完整性与透明通道验证结果。

敌人提供四向基础造型，厚皮者/酸液者/拆墙者/尖啸者另提供四向前摇关键姿态。主角八向每向3张奔跑素材另在 `../player-run-v1`。

房屋基体与屋顶分离；门开关、陷阱张开/命中、菜箱生长与容器状态分别提供。PNG保留生成的原始透明通道，没有用代码裁剪或重绘。程序接入时统一标定显示尺寸、足点和屋顶锚点，并配置碰撞与计时；此素材目录不改变游戏规则。

验证命令（系统Windows PowerShell）：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File art/2d/expansion-v1/finalize-assets.ps1
```
