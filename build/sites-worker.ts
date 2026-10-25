import {localeFromPath,isLocale} from '../lib/i18n/core';
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import {applyIndexingHeader,indexingPolicy} from '../lib/public/seo-policy';

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const incomingUrl=new URL(request.url);
    const locale= incomingUrl.pathname.startsWith('/api/') && isLocale(incomingUrl.searchParams.get('locale')) ? incomingUrl.searchParams.get('locale')! : localeFromPath(incomingUrl.pathname);
    const localeHeaders=new Headers(request.headers);localeHeaders.set('x-doublebottle-locale',locale);
    request=new Request(request,{headers:localeHeaders});
    const response=await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    const url=new URL(request.url);
    return applyIndexingHeader(response,indexingPolicy(env as unknown as Record<string,string|undefined>,url.host),url.pathname);
  },
};
