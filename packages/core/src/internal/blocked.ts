export interface BlockedInfo {
  url: string;
  service?: string;
  category?: string;
  kind: "script" | "iframe" | "image" | "fetch" | "xhr" | "beacon";
  ts: number;
}
