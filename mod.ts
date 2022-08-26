import { parse } from "./deps/flags.ts";
import { posix } from "./deps/path.ts";
import Site from "./core/site.ts";
import url, { Options as UrlOptions } from "./plugins/url.ts";
import json, { Options as JsonOptions } from "./plugins/json.ts";
import markdown, { Options as MarkdownOptions } from "./plugins/markdown.ts";
import modules, { Options as ModulesOptions } from "./plugins/modules.ts";
import nunjucks, { Options as NunjucksOptions } from "./plugins/nunjucks.ts";
import search, { Options as SearchOptions } from "./plugins/search.ts";
import paginate, { Options as PaginateOptions } from "./plugins/paginate.ts";
import yaml, { Options as YamlOptions } from "./plugins/yaml.ts";
import { merge } from "./core/utils.ts";

import type {
  ComponentsOptions,
  ServerOptions,
  SiteOptions,
  WatcherOptions,
} from "./core/site.ts";

interface PluginOptions {
  url?: Partial<UrlOptions>;
  json?: Partial<JsonOptions>;
  markdown?: Partial<MarkdownOptions>;
  modules?: Partial<ModulesOptions>;
  nunjucks?: Partial<NunjucksOptions>;
  search?: Partial<SearchOptions>;
  paginate?: Partial<PaginateOptions>;
  yaml?: Partial<YamlOptions>;
}

interface Options
  extends Omit<Partial<SiteOptions>, "server" | "watcher" | "components"> {
  server?: Partial<ServerOptions>;
  watcher?: Partial<WatcherOptions>;
  components?: Partial<ComponentsOptions>;
}

export default function (
  options: Options = {},
  pluginOptions: PluginOptions = {},
  cliOptions = true,
) {
  if (cliOptions) {
    options = merge(options, getOptionsFromCli());
  }

  const site = new Site(options as Partial<SiteOptions>);

  // Ignore the .git folder and .DS_Store file by the watcher
  site.options.watcher.ignore.push(".git");
  site.options.watcher.ignore.push((path) => path.endsWith("/.DS_Store"));

  return site
    .ignore("node_modules")
    .ignore("import_map.json")
    .ignore("deno.json")
    .ignore("deno.jsonc")
    .use(url(pluginOptions.url))
    .use(json(pluginOptions.json))
    .use(markdown(pluginOptions.markdown))
    .use(modules(pluginOptions.modules))
    .use(nunjucks(pluginOptions.nunjucks))
    .use(paginate(pluginOptions.paginate))
    .use(search(pluginOptions.search))
    .use(yaml(pluginOptions.yaml));
}

function getOptionsFromCli(): Partial<Options> {
  const options = parse(Deno.args, {
    string: [
      "root",
      "src",
      "dest",
      "location",
      "port",
    ],
    boolean: ["quiet", "serve", "open"],
    alias: { serve: "s", port: "p", open: "o" },
    ["--"]: true,
  });

  const overrides: Partial<Options> = {};

  if (options.root) {
    overrides.cwd = posix.resolve(Deno.cwd(), options.root);
  }

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

  if (options.quiet) {
    overrides.quiet = options.quiet;
  }

  if (options.port) {
    (overrides.server ||= {}).port = parseInt(options.port);
  }

  if (options.open) {
    (overrides.server ||= {}).open = options.open;
  }

  return overrides;
}
