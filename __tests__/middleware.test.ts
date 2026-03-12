/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

function createRequest(path: string, cookies: Record<string, string> = {}) {
  const url = new URL(path, "http://localhost:3000");
  const req = new NextRequest(url);
  for (const [key, value] of Object.entries(cookies)) {
    req.cookies.set(key, value);
  }
  return req;
}

describe("middleware", () => {
  it("redirects unauthenticated users from /dashboard to /login", () => {
    const req = createRequest("/dashboard");
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("redirects unauthenticated users from /dashboard/articles to /login", () => {
    const req = createRequest("/dashboard/articles");
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("allows authenticated users to access /dashboard", () => {
    const req = createRequest("/dashboard", { __session: "1" });
    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  it("redirects authenticated users from /login to /dashboard", () => {
    const req = createRequest("/login", { __session: "1" });
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("allows unauthenticated users to access /login", () => {
    const req = createRequest("/login");
    const res = middleware(req);
    expect(res.status).toBe(200);
  });
});
