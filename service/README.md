# 应用侧接入说明（service/）

`service/` 目录属于**应用仓库本身**，随应用一起部署，不依赖宿主站点注入。

```
service/
├─ tornier-service.js   TornierService v1 客户端 SDK（来自独立框架包）
└─ metrics.js           本应用的业务埋点（只读 window.PT / window.InfoLen 状态）
```

`index.html` 末尾两行：

```html
<script src="./service/tornier-service.js" data-service="potential-threat" defer></script>
<script src="./service/metrics.js" defer></script>
```

- 部署在 `tornier.io` 子路径时，SDK 默认上报同源 `/api/service/event`。
- 部署到**别的域名**时，给第一行加 `data-endpoint="https://<宿主>/api/service/event"`；
  宿主的 `server/route.js` 已带 CORS，可直接跨站上报。
- 宿主需在 Works 里登记相同 `service_key`，并执行 `server/schema.sql`。
- 事件契约见框架包 `contract.md`；上报失败静默忽略，不影响应用运行。
