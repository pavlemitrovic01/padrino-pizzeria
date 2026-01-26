declare type DenoServeHandler = (
  req: Request
) => Response | Promise<Response>;

declare interface DenoServeOptions {
  port?: number;
  hostname?: string;
  onListen?: (params: { hostname: string; port: number }) => void;
}

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: DenoServeHandler, options?: DenoServeOptions) => void;
};
