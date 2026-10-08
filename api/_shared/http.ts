/** JSON responses for Vercel handlers (B26: one copy instead of 9). */

export type JsonResLike = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => JsonResLike;
  send: (body: string) => void;
};

export function json(res: JsonResLike, status: number, body: Record<string, unknown>) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(JSON.stringify(body));
}
