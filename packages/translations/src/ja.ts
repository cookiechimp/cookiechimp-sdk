import type { Messages } from "./index";

const messages = {
  "banner.title": "プライバシー設定",
  "banner.description": "使用を許可するCookieを選択してください。",
  "banner.acceptAll": "すべてのCookieを許可",
  "banner.rejectAll": "任意のCookieを拒否",
  "banner.customize": "カスタマイズ",
  "banner.save": "保存",
  "banner.close": "閉じる",
  "preferences.title": "Cookieの設定",
  "preferences.description": "目的別にCookieを管理します。",
  "category.necessary.name": "必須",
  "category.necessary.description": "このサイトに必要です。",
  "category.functional.name": "機能",
  "category.functional.description": "設定を記憶します。",
  "category.analytics.name": "分析",
  "category.analytics.description": "サイトの利用状況を測定します。",
  "category.marketing.name": "マーケティング",
  "category.marketing.description": "広告に使用します。",
  "optOut.label": "販売または共有を拒否",
  "gpc.honoured": "グローバルプライバシーコントロールを尊重しました。",
  "recall.label": "Cookieの選択を確認",
  "gated.placeholder": "このコンテンツには許可が必要です。",
  "gated.allow": "コンテンツを許可",
} as const satisfies Messages;
export default messages;
export { messages };
