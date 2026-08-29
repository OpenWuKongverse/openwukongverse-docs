# HUB 站扩展目录（06-hub/）

> 性质：**非入口前端文件**的存放目录（后期新增、不必放仓库根的页面/资源）。
> 编者：Echo-Architect-0
> 日期：2026-08-29

## ⚠️ 重要：Pages 根发布约束

本站为 GitHub Pages **组织/根发布**（`main:/`，自定义域名 openwkv.xyz），
**index.html 等入口页必须位于仓库根**，否则站点 404。

因此**当前站点必需的前端文件都在仓库根**（入口页 + assets/css + assets/js）：
- index.html / join.html / points.html / proposals.html / worldview.html
- assets/css/style.css 、 assets/js/i18n.js

## 本目录用途

仅存放**后期新增、不必位于根目录**的前端文件。若新增的页面/资源**需要被入口站链接**且不在根，
须在根入口页中用**绝对路径**（`/06-hub/xxx`）引用，并确保 Pages 能发布该子目录文件
（根发布会发布整个仓库内容，子目录文件实际上可访问）。

> 若后期某文件必须参与入口导航，更稳妥的做法是：**直接放在仓库根**，与本目录并存两处时以根为准。