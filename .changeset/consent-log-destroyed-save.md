---
"@cookiechimp/core": patch
---

A destroyed consent log no longer writes its queue to storage when a request finishes, so it can't erase newer records saved by the log that replaced it.
