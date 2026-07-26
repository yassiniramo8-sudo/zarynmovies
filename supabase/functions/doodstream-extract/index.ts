import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Extracts a direct playable URL from a Doodstream embed link.
// Uses the well-known "pass_md5" flow: fetch embed page -> extract /pass_md5/<token>
// -> fetch that endpoint (with Referer) -> receive direct stream base -> append random token.

function randomToken(len = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function extractHost(u: string): string | null {
  try { return new URL(u).host; } catch { return null; }
}

function normalizeToEmbed(url: string): string {
  // Convert /d/<id> to /e/<id> for the embed page
  return url.replace(/\/d\//, '/e/');
}

async function extractDoodstream(url: string): Promise<{ direct: string; referer: string } | null> {
  const embedUrl = normalizeToEmbed(url);
  const host = extractHost(embedUrl);
  if (!host) return null;
  const origin = `https://${host}`;

  const uaHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Referer': origin + '/',
  };

  const pageRes = await fetch(embedUrl, { headers: uaHeaders });
  if (!pageRes.ok) return null;
  const html = await pageRes.text();

  const passMatch = html.match(/\/pass_md5\/[^\s"'<>]+/);
  if (!passMatch) return null;
  const passUrl = origin + passMatch[0];

  const tokenMatch = passMatch[0].match(/\/pass_md5\/[^/]+\/([^/?"'\s]+)/);
  const streamToken = tokenMatch ? tokenMatch[1] : '';

  const passRes = await fetch(passUrl, {
    headers: { ...uaHeaders, 'Referer': embedUrl, 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!passRes.ok) return null;
  const base = (await passRes.text()).trim();
  if (!base.startsWith('http')) return null;

  const direct = `${base}${randomToken(10)}?token=${streamToken}&expiry=${Date.now()}`;
  return { direct, referer: embedUrl };
}

function isDoodstream(url: string): boolean {
  return /doods?tream|dood\.(?:so|to|watch|pm|wf|re|la|yt|ws|sh|cx|li)|d0000d|d0o0d|dooood/i.test(url);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    let url: string | null = null;
    if (req.method === 'GET') {
      url = new URL(req.url).searchParams.get('url');
    } else {
      const body = await req.json().catch(() => ({}));
      url = body?.url ?? null;
    }

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isDoodstream(url)) {
      return new Response(JSON.stringify({ error: 'Not a Doodstream URL', supported: false }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await extractDoodstream(url);
    if (!result) {
      return new Response(JSON.stringify({ error: 'Extraction failed', supported: true }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ direct: result.direct, referer: result.referer, provider: 'doodstream' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
