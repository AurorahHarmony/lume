import lume from "../mod.ts";
import { toFileUrl } from "../deps/path.ts";
import { isUrl } from "../core/utils/path.ts";
import { getConfigFile } from "../core/utils/lume_config.ts";
import { log } from "../core/utils/log.ts";

import type Site from "../core/site.ts";

interface Options {
  config?: string;
}

export default function ({ config }: Options, ...scripts: string[]) {
  return run(config, scripts);
}

/** Run one or more custom scripts */
export async function run(
  config: string | undefined,
  scripts: string[],
) {
  const site = await createSite(config);

  for (const script of scripts) {
    const success = await site.run(script);

    if (!success) {
      addEventListener("unload", () => Deno.exit(1));
      break;
    }
  }
}

/** Create a site instance */
export async function createSite(config?: string): Promise<Site> {
  let url: string | undefined;

  if (config && isUrl(config)) {
    url = config;
  } else {
    const path = await getConfigFile(config);

    if (path) {
      url = toFileUrl(path).href;
    }
  }

  if (url) {
    log.info(`Loading config file <dim>${url}</dim>`);
    const mod = await import(url);
    return mod.default;
  }

  return lume();
}
