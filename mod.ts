import { parseArgs } from "./deps/cli.ts";
import Site from "./core/site.ts";
import url, { Options as UrlOptions } from "./plugins/url.ts";
import json, { Options as JsonOptions } from "./plugins/json.ts";
import markdown, { Options as MarkdownOptions } from "./plugins/markdown.ts";
import modules, { Options as ModulesOptions } from "./plugins/modules.ts";
import vento, { Options as VentoOptions } from "./plugins/vento.ts";
import search, { Options as SearchOptions } from "./plugins/search.ts";
import paginate, { Options as PaginateOptions } from "./plugins/paginate.ts";
import toml, { Options as TomlOptions } from "./plugins/toml.ts";
import yaml, { Options as YamlOptions } from "./plugins/yaml.ts";
import { merge } from "./core/utils/object.ts";

import type { DeepPartial } from "./core/utils/object.ts";
import type { SiteOptions } from "./core/site.ts";

export interface PluginOptions {
  url?: UrlOptions;
  json?: JsonOptions;
  markdown?: MarkdownOptions;
  modules?: ModulesOptions;
  vento?: VentoOptions;
  search?: SearchOptions;
  paginate?: PaginateOptions;
  toml?: TomlOptions;
  yaml?: YamlOptions;
}

export default function lume(
  options: DeepPartial<SiteOptions> = {},
  pluginOptions: PluginOptions = {},
  cliOptions = true,
): Site {
  if (cliOptions) {
    options = merge(options, getOptionsFromCli());
  }

  const site = new Site(options as Partial<SiteOptions>);

  // Ignore some files by the watcher
  site.options.watcher.ignore.push("/deno.lock");
  site.options.watcher.ignore.push("/node_modules/.deno");
  site.options.watcher.ignore.push("/.git");
  site.options.watcher.ignore.push((path) => path.endsWith("/.DS_Store"));

  return site
    .ignore("node_modules")
    .ignore("import_map.json")
    .ignore("deno.json")
    .ignore("deno.jsonc")
    .ignore("deno.lock")
    .mergeKey("tags", "stringArray")
    .use(url(pluginOptions.url))
    .use(json(pluginOptions.json))
    .use(markdown(pluginOptions.markdown))
    .use(modules(pluginOptions.modules))
    .use(vento(pluginOptions.vento))
    .use(paginate(pluginOptions.paginate))
    .use(search(pluginOptions.search))
    .use(toml(pluginOptions.toml))
    .use(yaml(pluginOptions.yaml));
}

function getOptionsFromCli(): DeepPartial<SiteOptions> {
  const options = parseArgs(Deno.args, {
    string: ["src", "dest", "location", "port"],
    boolean: ["serve", "open"],
    alias: { dev: "d", serve: "s", port: "p", open: "o" },
    ["--"]: true,
  });

  const overrides: DeepPartial<SiteOptions> = {};

  if (options.src) {
    overrides.src = options.src;
  }

  if (options.dest) {
    overrides.dest = options.dest;
  }

  if (options.location) {
    overrides.location = new URL(options.location);
  } else if (options.serve) {
    overrides.location = new URL(`http://localhost:${options.port || 3000}/`);
  }

  if (options.port) {
    (overrides.server ||= {}).port = parseInt(options.port);

    if (overrides.location) {
      overrides.location.port = options.port;
    }
  }

  if (options.open) {
    (overrides.server ||= {}).open = options.open;
  }

  return overrides;
}
