declare module "next" {
  export interface NextConfig {
    serverExternalPackages?: string[];
    experimental?: Record<string, unknown>;
  }

  export interface Metadata {
    title?: string;
    description?: string;
    [key: string]: unknown;
  }
}

declare module "next/link" {
  import type { AnchorHTMLAttributes, DetailedHTMLProps, ReactElement } from "react";

  export default function Link(
    props: DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement> & {
      href: string;
    }
  ): ReactElement;
}

declare module "next/navigation" {
  export function useRouter(): {
    push: (href: string) => void;
    refresh: () => void;
  };

  export function useSearchParams(): URLSearchParams;
  export function redirect(path: string): never;
}

declare module "next/server" {
  export interface NextRequest extends Request {
    nextUrl: URL;
    cookies: {
      get: (name: string) => { value: string } | undefined;
    };
  }

  export class NextResponse extends Response {
    static json(body?: unknown, init?: ResponseInit): NextResponse;
    static redirect(url: string | URL, init?: number | ResponseInit): NextResponse;
    static next(): NextResponse;
    cookies: {
      get: (name: string) => { value: string } | undefined;
      set: (options: {
        name: string;
        value: string;
        httpOnly?: boolean;
        sameSite?: "lax" | "strict" | "none";
        secure?: boolean;
        path?: string;
        maxAge?: number;
      }) => void;
    };
  }
}

declare module "next/headers" {
  export function cookies(): Promise<{
    get: (name: string) => { value: string } | undefined;
  }>;
}

declare module "next/font/google" {
  export function Manrope(options: Record<string, unknown>): { className: string; variable: string };
  export function IBM_Plex_Sans_Thai(options: Record<string, unknown>): { className: string; variable: string };
}