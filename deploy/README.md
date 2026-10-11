# Docker 云服务器部署

游戏是纯静态网页，所有游戏逻辑在浏览器运行，不需要数据库或后端。
镜像使用 Nginx 官方 `stable-alpine` 镜像，包含游戏网页、脚本和美术资源。

## 与 StudyAssistant 同机运行

将本工程放到独立目录，用独立 Compose 项目 `leo-survivor` 运行。
默认使用宿主机 8081 端口，容器内部使用 80。多个容器可以使用相同的内部端口，宿主机映射端口必须不同。
先用 `docker ps --format 'table {{.Names}}\t{{.Ports}}'` 查看现有服务；如果 8081 已占用，请改用空闲端口。
本配置不依赖 StudyAssistant 的 Compose 文件，直接分别启动即可。

## 在服务器构建并启动

服务器需安装 Docker Engine 和 Compose 插件。以下命令在 Linux 服务器执行：

```bash
git clone https://github.com/GithubRichard/Leo_Survivor.git
cd Leo_Survivor
docker compose up -d --build
docker compose ps
curl -f http://127.0.0.1:8081/healthz
```

浏览器访问 `http://服务器公网IP:8081`。在云服务器安全组与系统防火墙中允许 TCP 8081。
如果端口冲突：

```bash
GAME_PORT=8082 docker compose up -d --build
```

长期自定义端口可在项目根目录创建 `.env`，写入 `GAME_PORT=8082`，后续命令会自动读取。

## 通过域名访问

如果现有服务已占用 80/443，可让现有反向代理用独立子域名转发游戏。
若反向代理运行在宿主机，创建 `.env`，写入：

```dotenv
GAME_BIND_ADDRESS=127.0.0.1
GAME_PORT=8081
```

然后将游戏域名转发到 `http://127.0.0.1:8081`，并在代理处配置 HTTPS。
若反向代理也在 Docker 容器里，容器内的 `127.0.0.1` 是代理容器自身；需将两者接入共同 Docker 网络并使用游戏服务网络地址。
本工程默认仍使用独立网络，具体代理配置需根据现有服务调整。

## 更新和查看日志

```bash
git pull
docker compose up -d --build
docker compose logs --tail=100 game
```

停止游戏服务，在本工程目录执行 `docker compose down`。
当前游戏没有服务端存档，玩家刷新页面后重新开始。

## 导出可搬运的镜像包

在装有 Docker 的机器上构建与服务器架构一致的 Linux 镜像（常见 x86 服务器为 `linux/amd64`；ARM 服务器使用 `linux/arm64`）：

```bash
docker build --platform linux/amd64 -t leo-survivor:latest .
docker save -o leo-survivor-image.tar leo-survivor:latest
```

将 `leo-survivor-image.tar` 和 `compose.yaml` 上传到服务器同一个独立目录，在该目录执行：

```bash
docker load -i leo-survivor-image.tar
docker compose up -d --no-build --pull never
```

本地没有 Docker 时，可以直接把源代码部署包解压到服务器，进入含 Dockerfile 的目录，执行 `docker compose up -d --build`。
