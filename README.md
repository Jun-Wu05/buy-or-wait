# 买不买 · Buy or Wait

一个面向小红书/移动端场景的一天 MVP：用户回答 6 个问题，系统只做一个决策——**BUY / WAIT / SKIP**。

## 产品假设

用户在“被种草 → 犹豫 → 付款”之间缺少一个非常轻量的冷静决策工具。相比聊天机器人，本产品不生成长建议，只给一个明确动作、概率分布和冷静期。

## MVP 功能

- 6 步移动端问卷
- BUY / WAIT / SKIP 三分类决策
- Jev `Choice` 决策接口
- 无 API Key 时自动启用本地 Demo 决策，方便预览
- 结果页显示置信度与三项概率
- 适合截图分享的结果卡视觉

## 本地运行

要求 Node.js 20+。

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

### 接入 Jev

```bash
cp .env.example .env
# 设置 TYPESAFE_API_KEY 后，将它加载进 shell，再运行 npm run dev
```

项目使用 TypeSafe 官方 JavaScript SDK：

```js
import { choice, TypeSafeClient } from '@typesafe-ai/sdk';
```

没有 `TYPESAFE_API_KEY` 时，UI 仍可完整体验，但页面会标记 `DEMO DECISION · JEV READY`。

## 决策输入

```json
{
  "price": 899,
  "monthlyBudget": 1800,
  "desire": 8,
  "similarOwned": 2,
  "useFrequency": 3,
  "daysThinking": 3,
  "necessity": 5
}
```

## 下一版最值得做的 3 件事

1. 商品卡片：支持填写商品名与封面图，结果更适合分享。
2. 冷静期回访：WAIT 后生成 3/7 天复测入口。
3. 决策历史：统计自己一个月“被劝退了多少钱”。

## 技术栈

- 原生 HTML / CSS / JavaScript
- Node.js 内置 HTTP Server
- `@typesafe-ai/sdk`

这样做的目的就是让 MVP 足够小：无框架、无数据库、一天内能跑通产品闭环。
