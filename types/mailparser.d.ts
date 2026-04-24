declare module "mailparser" {
  export function simpleParser(
    source: string | Buffer | NodeJS.ReadableStream | undefined
  ): Promise<{
    subject?: string | null;
    text?: string | null;
    html?: string | Buffer | null;
    from?: { text?: string | null } | null;
  }>;
}
