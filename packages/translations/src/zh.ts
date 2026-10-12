import type { Messages } from "./index";

const messages = {
  "banner.title": "隐私选项",
  "banner.description": "选择可以使用的 Cookie。",
  "banner.acceptAll": "接受所有 Cookie",
  "banner.rejectAll": "拒绝可选 Cookie",
  "banner.customize": "自定义",
  "banner.save": "保存",
  "banner.close": "关闭",
  "preferences.title": "Cookie 偏好设置",
  "preferences.description": "按用途管理 Cookie。",
  "category.necessary.name": "必要",
  "category.necessary.description": "本站运行所必需。",
  "category.functional.name": "功能",
  "category.functional.description": "记住您的设置。",
  "category.analytics.name": "分析",
  "category.analytics.description": "衡量网站使用情况。",
  "category.marketing.name": "营销",
  "category.marketing.description": "用于支持广告。",
  "optOut.label": "拒绝出售或共享",
  "gpc.honoured": "已遵循全球隐私控制信号。",
  "recall.label": "查看 Cookie 选项",
  "gated.placeholder": "此内容需要您的许可。",
  "gated.allow": "允许内容",
} as const satisfies Messages;
export default messages;
export { messages };
