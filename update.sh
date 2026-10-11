#!/usr/bin/env bash
set -Eeuo pipefail

trap 'echo "更新失败（第 ${LINENO} 行），请查看上方错误。" >&2' ERR
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

mode="${1:-}"
if [[ $# -gt 1 || ( -n "$mode" && "$mode" != "--local" ) ]]; then
    echo "用法：bash update.sh [--local]" >&2
    echo "--local：跳过 Git 拉取，使用已上传的本地文件。" >&2
    exit 2
fi

command -v docker >/dev/null || { echo "请先安装 Docker。" >&2; exit 1; }
docker_cmd=(docker)
if ! docker info >/dev/null 2>&1; then
    echo "当前用户无法直接访问 Docker，尝试 sudo。"
    command -v sudo >/dev/null || { echo "Docker 不可用，且没有 sudo。" >&2; exit 1; }
    docker_cmd=(sudo docker)
    "${docker_cmd[@]}" info >/dev/null
fi
"${docker_cmd[@]}" compose version >/dev/null
compose=("${docker_cmd[@]}" compose -f compose.yaml --project-name leo-survivor)
"${compose[@]}" config --quiet

if [[ "$mode" != "--local" ]]; then
    command -v git >/dev/null || { echo "请先安装 Git，或使用 --local。" >&2; exit 1; }
    git rev-parse --is-inside-work-tree >/dev/null
    if [[ "$(git branch --show-current)" != "main" ]]; then
        echo "请在 main 分支执行更新。" >&2
        exit 1
    fi
    if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
        echo "工程存在未提交文件，请先处理本地改动再更新。" >&2
        exit 1
    fi
    echo "拉取 origin/main（网络失败时不会重启游戏）……"
    git -c http.connectTimeout=15 -c http.lowSpeedLimit=1024 -c http.lowSpeedTime=30 pull --ff-only origin main
fi

"${compose[@]}" config --quiet
echo "构建镜像（构建完成前保留现有游戏容器）……"
"${compose[@]}" build game
echo "重新创建游戏容器并等待健康检查……"
"${compose[@]}" up -d --no-build --force-recreate --no-deps game
container_id="$("${compose[@]}" ps -q game)"
if [[ -z "$container_id" ]]; then
    echo "未找到运行中的游戏容器。" >&2
    "${compose[@]}" logs --tail=80 game
    exit 1
fi
for ((attempt=0; attempt<60; attempt++)); do
    status="$("${docker_cmd[@]}" inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container_id")"
    if [[ "$status" == "running healthy" ]]; then
        echo "更新完成，游戏服务健康。"
        "${compose[@]}" ps game
        exit 0
    fi
    if [[ "$status" == *unhealthy* || "$status" == exited* || "$status" == dead* ]]; then
        break
    fi
    sleep 2
done
echo "游戏未通过健康检查，请查看日志：" >&2
"${compose[@]}" logs --tail=80 game
exit 1
