import { posix } from "../deps/path.ts";
import { documentToString, stringToDocument } from "./utils.ts";

import type { HTMLDocument } from "../deps/dom.ts";
import type { PageData, ProxyComponents } from "../core.ts";
import type { Entry } from "./fs.ts";

/** A page of the site */
export class Page {
  /** The src info */
  src: Src;

  /**
   * Used to save the page data
   */
  data: PageData = {} as PageData;

  /**
   * Internal data. Used to save arbitrary data by plugins and processors
   */
  #_data = {};

  /** The page content (string or Uint8Array) */
  #content?: Content;

  /** The parsed HTML (only for HTML documents) */
  #document?: HTMLDocument;

  /** Convenient way to create a page dynamically with a url and content */
  static create(url: string, content: Content): Page {
    const slug = posix.basename(url).replace(/\.[\w.]+$/, "");
    const page = new Page({ slug });

    if (url.endsWith("/index.html")) {
      url = url.slice(0, -10);
    }

    page.data = { url, content, page } as PageData;
    page.content = content;

    return page;
  }

  constructor(src?: Partial<Src>) {
    this.src = { path: "", slug: "", asset: true, ...src };
  }

  /**
   * The property _data is to store internal data,
   * used by plugins, processors, etc to save arbitrary values
   */
  set _data(data: Record<string, unknown>) {
    this.#_data = data;
  }

  get _data() {
    return this.#_data;
  }

  /** Duplicate this page. */
  duplicate(index?: number, data: Data = {}): Page {
    const page = new Page({ ...this.src });

    if (index !== undefined) {
      page.src.path += `[${index}]`;
    }

    page.data = data as PageData;
    page.data.page = page;

    return page;
  }

  /** Returns the output path of this page */
  get outputPath(): string | undefined {
    const url = this.data.url;

    if (!url) {
      return undefined;
    }

    return url.endsWith("/") ? url + "index.html" : url;
  }

  /** The content of this page */
  set content(content: Content | undefined) {
    this.#document = undefined;
    this.#content = content instanceof Uint8Array
      ? content
      : content && content.toString();
  }

  get content(): Content | undefined {
    if (this.#document) {
      this.#content = documentToString(this.#document);
      this.#document = undefined;
    }

    return this.#content;
  }

  /** The parsed HTML code from the content */
  set document(document: HTMLDocument | undefined) {
    this.#content = undefined;
    this.#document = document;
  }

  get document(): HTMLDocument | undefined {
    const url = this.data.url as string;

    if (
      !this.#document && this.#content &&
      (url.endsWith(".html") || url.endsWith("/"))
    ) {
      this.#document = stringToDocument(this.#content.toString());
    }

    return this.#document;
  }
}

export interface StaticFile {
  /** The Entry instance of the file */
  entry: Entry;

  /** The final url destination */
  outputPath: string;
}

/** The .src property for a Page or Directory */
export interface Src {
  /** The slug name of the file or directory */
  slug: string;

  /** If the page was loaded as asset or not */
  asset: boolean;

  /** The path to the file (without extension) */
  path: string;

  /** The extension of the file (undefined for folders) */
  ext?: string;

  /** The last modified time */
  lastModified?: Date;

  /** The creation time */
  created?: Date;

  /** The remote url (if the file was downloaded) */
  remote?: string;

  /** The original entry instance */
  entry?: Entry;
}

/** The .content property for a Page */
export type Content = Uint8Array | string;

/** The data of a page */
export interface Data {
  /** List of tags assigned to a page or folder */
  tags?: string[];

  /** The url of a page */
  url?: string | ((page: Page) => string) | false;

  /** If is `true`, the page will be visible only in `dev` mode */
  draft?: boolean;

  /** The date creation of the page */
  date?: Date;

  /** To configure the render order of a page */
  renderOrder?: number;

  /** The raw content of a page */
  content?: unknown;

  /** The layout used to render a page */
  layout?: string;

  /** To configure a different template engine(s) to render a page */
  templateEngine?: string | string[];

  /** To configure how some data keys will be merged with the parent */
  mergedKeys?: Record<string, "array" | "stringArray" | "object">;

  /** Whether render this page on demand or not */
  ondemand?: boolean;

  /** The available components */
  comp?: ProxyComponents;

  /** The page object */
  page?: Page;

  // deno-lint-ignore no-explicit-any
  [index: string]: any;
}
