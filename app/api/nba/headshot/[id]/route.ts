import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const upstream = await fetch(
    `https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`,
    { next: { revalidate: 60 * 60 * 24 } },
  );

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Not found" }, { status: upstream.status });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
}
