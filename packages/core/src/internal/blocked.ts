export interface BlockedInfo {
  url: string;
  service?: string;
  category: string;
  kind: "script" | "iframe" | "fetch" | "xhr" | "beacon";
  ts: number;
}
