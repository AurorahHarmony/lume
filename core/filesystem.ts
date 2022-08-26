import { posix } from "../deps/path.ts";
import { createDate, documentToString, stringToDocument } from "./utils.ts";

import type { HTMLDocument } from "../deps/dom.ts";
import type { ProxyComponents } from "../core.ts";

/** Abstract class with common functions for Page and Directory classes */
abstract class Base {
  /** The src info */
  src: Src;

  /** The destination info */
  dest: Dest;

  /** The parent directory */
  #parent?: Directory;

  /**
   * Used to save the assigned data directly
   * For directories, the content of _data or _data.* files
   * For pages, the front matter or exported variables.
   */
  #data: Data = {};

  /**
   * Internal data. Used to save arbitrary data by plugins and processors
   */
  #_data = {};

  /**
   * Used to save the merged data:
   * the base data with the parent data
   */
  #cache?: Data;

  constructor(src?: Src) {
    this.src = src || { path: "" };
    this.dest = {
      path: this.src.path,
      ext: this.src.ext || "",
    };

    // Detect the date of the page/directory in the filename
    const basename = posix.basename(this.src.path);
    const dateInPath = basename.match(/^([^_]+)?_/);

    if (dateInPath) {
      const [found, dateStr] = dateInPath;
      const date = createDate(dateStr);

      if (date) {
        this.dest.path = this.dest.path.replace(found, "");
        this.#data.date = date;
      }
    }

    // Make data enumerable
    const descriptor: PropertyDescriptor =
      Object.getOwnPropertyDescriptor(Base.prototype, "data") || {};
    descriptor.enumerable = true;
    Object.defineProperty(this, "data", descriptor);
  }

  /** Returns the parent directory */
  get parent(): Directory | undefined {
    return this.#parent;
  }

  /** Set the parent directory */
  set parent(parent: Directory | undefined) {
    this.dest.path = posix.join(
      parent?.dest.path || "/",
      posix.basename(this.dest.path),
    );
    this.#parent = parent;
  }

  /** Returns the front matter for pages, _data for directories */
  get baseData(): Data {
    return this.#data;
  }

  /** Set front matter for pages, _data for directories */
  set baseData(data: Data) {
    this.#data = data;
    this.refreshCache();
  }

  /**
   * Merge the data of parent directories recursively
   * and return the merged data
   */
  get data(): Data {
    if (this.#cache) {
      return this.#cache;
    }

    // Merge the data of the parent directories
    const pageData: Data = this instanceof Page
      ? { page: this, ...this.baseData }
      : this.baseData;

    const parentData: Data = this.parent?.data || {};
    const data: Data = { ...parentData, ...pageData };

    // Merge special keys
    const mergedKeys: Record<string, string> = {
      tags: "stringArray",
      ...parentData.mergedKeys,
      ...pageData.mergedKeys,
    };

    for (const [key, type] of Object.entries(mergedKeys)) {
      switch (type) {
        case "stringArray":
        case "array":
          {
            const pageValue: unknown[] = Array.isArray(pageData[key])
              ? pageData[key] as unknown[]
              : (key in pageData)
              ? [pageData[key]]
              : [];

            const parentValue: unknown[] = Array.isArray(parentData[key])
              ? parentData[key] as unknown[]
              : (key in parentData)
              ? [parentData[key]]
              : [];

            const merged = [...parentValue, ...pageValue];

            data[key] = [
              ...new Set(
                type === "stringArray" ? merged.map(String) : merged,
              ),
            ];
          }
          break;

        case "object":
          {
            const pageValue = pageData[key] as
              | Record<string, unknown>
              | undefined;
            const parentValue = parentData[key] as
              | Record<string, unknown>
              | undefined;

            data[key] = { ...parentValue, ...pageValue };
          }
          break;
      }
    }

    return this.#cache = data;
  }

  /** Replace the data of this object with the given data */
  set data(data: Data) {
    this.#cache = undefined;
    this.#data = data;
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

  /** Clean the cache of the merged data */
  refreshCache(): boolean {
    if (this.#cache) {
      this.#cache = undefined;
      return true;
    }
    return false;
  }
}

/** A page of the site */
export class Page extends Base {
  /** The page content (string or Uint8Array) */
  #content?: Content;

  /** The parsed HTML (only for HTML documents) */
  #document?: HTMLDocument;

  /** Convenient way to create a page dynamically with a url and content */
  static create(url: string, content: Content): Page {
    const ext = posix.extname(url);
    const path = ext ? url.slice(0, -ext.length) : url;

    const page = new Page();
    page.data = { url, content };
    page.content = content;
    page.updateDest({ path, ext });

    return page;
  }

  /** Duplicate this page. Optionally, you can provide new data */
  duplicate(index: number | string, data = {}): Page {
    const page = new Page({ ...this.src });
    page.parent = this.parent;
    page.dest = { ...this.dest };

    const pageData = { ...this.data, ...data };
    delete pageData.page;

    page.data = pageData;
    page.src.path += `[${index}]`;

    return page;
  }

  updateDest(
    dest: Partial<Dest>,
    prettyUrl: boolean | "no-html-extension" = false,
  ): void {
    this.dest = { ...this.dest, ...dest };
    const { path, ext } = this.dest;

    if (ext === ".html") {
      if (posix.basename(path) === "index") {
        this.data.url = path.slice(0, -5);
      } else if (prettyUrl === "no-html-extension") {
        this.data.url = path;
      } else {
        this.data.url = path + ext;
      }
    } else {
      this.data.url = path + ext;
    }
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
    if (
      !this.#document && this.#content &&
      (this.dest.ext === ".html" || this.dest.ext === ".htm")
    ) {
      this.#document = stringToDocument(this.#content.toString());
    }

    return this.#document;
  }
}

/** A directory in the src folder */
export class Directory extends Base {
  pages = new Map<string, Page>();
  dirs = new Map<string, Directory>();
  staticFiles = new Set<StaticFile>();
  components?: Components;

  /** Create a subdirectory and return it */
  createDirectory(name: string): Directory {
    const path = posix.join(this.src.path, name);
    const directory = new Directory({ path });
    directory.parent = this;
    this.dirs.set(name, directory);

    return directory;
  }

  /** Add a page to this directory */
  setPage(name: string, page: Page) {
    const oldPage = this.pages.get(name);
    page.parent = this;
    page.dest.path = posix.join(this.dest.path, posix.basename(page.dest.path));
    this.pages.set(name, page);

    if (oldPage) {
      page.dest.hash = oldPage.dest.hash;
    }
  }

  /** Remove a page from this directory */
  unsetPage(name: string) {
    this.pages.delete(name);
  }

  /** Add a static file to this directory */
  setStaticFile(file: StaticFile) {
    this.staticFiles.add(file);
  }

  /** Get the components of this directory and parent directories */
  getComponents(): Components | undefined {
    if (!this.components) {
      return;
    }

    return this.parent
      ? new Map([
        ...this.parent.getComponents()?.entries() ?? [],
        ...this.components?.entries() ?? [],
      ])
      : this.components;
  }

  /** Return the list of pages in this directory recursively */
  *getPages(): Iterable<Page> {
    for (const page of this.pages.values()) {
      yield page;
    }

    for (const dir of this.dirs.values()) {
      yield* dir.getPages();
    }
  }

  /** Return the list of static files in this directory recursively */
  *getStaticFiles(): Iterable<StaticFile> {
    for (const file of this.staticFiles) {
      yield file;
    }

    for (const dir of this.dirs.values()) {
      yield* dir.getStaticFiles();
    }
  }

  /** Refresh the data cache in this directory recursively (used for rebuild) */
  refreshCache(): boolean {
    if (super.refreshCache()) {
      this.pages.forEach((page) => page.refreshCache());
      this.dirs.forEach((dir) => dir.refreshCache());
      return true;
    }

    return false;
  }
}

export interface StaticFile {
  /** The path to the source file */
  src: string;

  /** The path to the destination file */
  dest: string;

  /** Indicates whether the file was copied after the latest change */
  saved?: boolean;

  /** Indicates whether the source file was removed */
  removed?: boolean;

  /** The remote url (if the file was downloaded) */
  remote?: string;
}

/** The .src property for a Page or Directory */
export interface Src {
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
}

/** The .dest property for a Page */
export interface Dest {
  /** The path to the file (without extension) */
  path: string;

  /** The extension of the file */
  ext: string;

  /** The hash (used to detect content changes) */
  hash?: string;
}

/** The .content property for a Page */
export type Content = Uint8Array | string;

/** The data of a page */
export interface Data {
  /** List of tags assigned to a page or folder */
  tags?: string[];

  /** The url of a page */
  url?: string | ((page: Page) => string) | false;

  /** Mark the page as a draft */
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

  [index: string]: unknown;
}

export interface Component {
  /** The file path of the component */
  path: string;

  /** Name of the component (used to get it from templates) */
  name: string;

  /** The function that will be called to render the component */
  render: (props: Record<string, unknown>) => string;

  /** Optional CSS code needed to style the component (global, only inserted once) */
  css?: string;

  /** Optional JS code needed for the component interactivity (global, only inserted once) */
  js?: string;
}

export type Components = Map<string, Component | Components>;
