import { installGpp } from "@cookiechimp/core/gpp";
import { installTcf } from "@cookiechimp/core/tcf";
import { TcfVendorList } from "@cookiechimp/react/tcf";
import { TcfProvider } from "@cookiechimp/react/tcf-provider";

// One graph includes the provider's dynamic import and deduplicates the core.
export const iab = { installGpp, installTcf, TcfVendorList, TcfProvider };
