export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url is required" });

  // インスタグラムは取得不可
  if (url.includes("instagram.com")) {
    return res.status(400).json({ error: "instagram not supported" });
  }

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; recipe-fetcher/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ja,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    // HTMLタグを除去してテキストだけ抽出（最大3000文字）
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);
    return res.status(200).send(text);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
