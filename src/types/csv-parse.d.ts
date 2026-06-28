declare module "csv-parse/sync" {
  import { Options } from "csv-parse";
  export function parse(input: string, options?: Options): unknown[];
}
