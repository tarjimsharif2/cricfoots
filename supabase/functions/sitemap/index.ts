import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

const MAX_URLS_PER_SITEMAP = 1000; // Google recommends max 50,000 but we use 1000 for better performance

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type'); // 'index', 'matches', 'tournaments', 'pages', or null for combined
    const page = parseInt(url.searchParams.get('page') || '1');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get site settings for canonical URL
    const { data: siteSettings } = await supabase
      .from('site_settings_public')
      .select('canonical_url')
      .single();

    const baseUrl = siteSettings?.canonical_url?.replace(/\/$/, '') || 'https://example.com';
    const projectId = 'doqteforumjdugifxryl';
    const functionBaseUrl = `https://${projectId}.supabase.co/functions/v1/sitemap`;

    // Return sitemap index
    if (type === 'index') {
      console.log('Generating sitemap index...');
      return await generateSitemapIndex(supabase, baseUrl, functionBaseUrl);
    }

    // Return specific sitemap type
    if (type === 'matches') {
      console.log(`Generating matches sitemap (page ${page})...`);
      return await generateMatchesSitemap(supabase, baseUrl, page);
    }

    if (type === 'tournaments') {
      console.log('Generating tournaments sitemap...');
      return await generateTournamentsSitemap(supabase, baseUrl);
    }

    if (type === 'pages') {
      console.log('Generating pages sitemap...');
      return await generatePagesSitemap(supabase, baseUrl);
    }

    // Default: return combined sitemap for smaller sites
    console.log('Generating combined sitemap...');
    return await generateCombinedSitemap(supabase, baseUrl);

  } catch (error) {
    console.error('Error generating sitemap:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function generateSitemapIndex(supabase: any, baseUrl: string, functionBaseUrl: string): Promise<Response> {
  // Count URLs to determine how many sitemap files we need
  const { count: matchCount } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('slug', 'is', null);

  const { count: tournamentCount } = await supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('slug', 'is', null);

  const { count: pageCount } = await supabase
    .from('dynamic_pages')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  const now = new Date().toISOString().split('T')[0];
  const sitemaps: { loc: string; lastmod: string }[] = [];

  // Add matches sitemaps (paginated if needed)
  const matchPages = Math.ceil((matchCount || 0) / MAX_URLS_PER_SITEMAP);
  for (let i = 1; i <= Math.max(1, matchPages); i++) {
    sitemaps.push({
      loc: `${functionBaseUrl}?type=matches&page=${i}`,
      lastmod: now,
    });
  }

  // Add tournaments sitemap
  if ((tournamentCount || 0) > 0) {
    sitemaps.push({
      loc: `${functionBaseUrl}?type=tournaments`,
      lastmod: now,
    });
  }

  // Add pages sitemap
  if ((pageCount || 0) > 0) {
    sitemaps.push({
      loc: `${functionBaseUrl}?type=pages`,
      lastmod: now,
    });
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const sitemap of sitemaps) {
    xml += '  <sitemap>\n';
    xml += `    <loc>${escapeXml(sitemap.loc)}</loc>\n`;
    xml += `    <lastmod>${sitemap.lastmod}</lastmod>\n`;
    xml += '  </sitemap>\n';
  }

  xml += '</sitemapindex>';

  console.log(`Sitemap index generated with ${sitemaps.length} sitemaps (${matchCount} matches, ${tournamentCount} tournaments, ${pageCount} pages)`);

  return new Response(xml, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function generateMatchesSitemap(supabase: any, baseUrl: string, page: number): Promise<Response> {
  const offset = (page - 1) * MAX_URLS_PER_SITEMAP;
  
  const { data: matches, error } = await supabase
    .from('matches')
    .select('slug, updated_at, status')
    .eq('is_active', true)
    .not('slug', 'is', null)
    .order('match_date', { ascending: false })
    .range(offset, offset + MAX_URLS_PER_SITEMAP - 1);

  if (error) {
    console.error('Error fetching matches:', error);
    throw error;
  }

  const urls: SitemapUrl[] = [];
  
  for (const match of matches || []) {
    if (match.slug) {
      urls.push({
        loc: `${baseUrl}/match/${match.slug}`,
        lastmod: match.updated_at ? new Date(match.updated_at).toISOString().split('T')[0] : undefined,
        changefreq: match.status === 'live' ? 'always' : match.status === 'upcoming' ? 'daily' : 'weekly',
        priority: match.status === 'live' ? 0.9 : match.status === 'upcoming' ? 0.8 : 0.6,
      });
    }
  }

  console.log(`Matches sitemap page ${page} generated with ${urls.length} URLs`);
  return new Response(generateSitemapXml(urls), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function generateTournamentsSitemap(supabase: any, baseUrl: string): Promise<Response> {
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('slug, updated_at')
    .eq('is_active', true)
    .not('slug', 'is', null);

  if (error) {
    console.error('Error fetching tournaments:', error);
    throw error;
  }

  const urls: SitemapUrl[] = [];
  
  for (const tournament of tournaments || []) {
    if (tournament.slug) {
      urls.push({
        loc: `${baseUrl}/tournament/${tournament.slug}`,
        lastmod: tournament.updated_at ? new Date(tournament.updated_at).toISOString().split('T')[0] : undefined,
        changefreq: 'daily',
        priority: 0.8,
      });
    }
  }

  console.log(`Tournaments sitemap generated with ${urls.length} URLs`);
  return new Response(generateSitemapXml(urls), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function generatePagesSitemap(supabase: any, baseUrl: string): Promise<Response> {
  const { data: pages, error } = await supabase
    .from('dynamic_pages')
    .select('slug, updated_at')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching pages:', error);
    throw error;
  }

  const urls: SitemapUrl[] = [];
  
  for (const page of pages || []) {
    urls.push({
      loc: `${baseUrl}/page/${page.slug}`,
      lastmod: page.updated_at ? new Date(page.updated_at).toISOString().split('T')[0] : undefined,
      changefreq: 'weekly',
      priority: 0.7,
    });
  }

  console.log(`Pages sitemap generated with ${urls.length} URLs`);
  return new Response(generateSitemapXml(urls), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function generateCombinedSitemap(supabase: any, baseUrl: string): Promise<Response> {
  const urls: SitemapUrl[] = [];

  // Add homepage
  urls.push({
    loc: baseUrl,
    changefreq: 'daily',
    priority: 1.0,
  });

  // Fetch active matches with slugs
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('slug, updated_at, status, match_date')
    .eq('is_active', true)
    .not('slug', 'is', null)
    .order('match_date', { ascending: false });

  if (matchesError) {
    console.error('Error fetching matches:', matchesError);
  } else if (matches) {
    console.log(`Found ${matches.length} matches for sitemap`);
    for (const match of matches) {
      if (match.slug) {
        urls.push({
          loc: `${baseUrl}/match/${match.slug}`,
          lastmod: match.updated_at ? new Date(match.updated_at).toISOString().split('T')[0] : undefined,
          changefreq: match.status === 'live' ? 'always' : match.status === 'upcoming' ? 'daily' : 'weekly',
          priority: match.status === 'live' ? 0.9 : match.status === 'upcoming' ? 0.8 : 0.6,
        });
      }
    }
  }

  // Fetch active tournaments with slugs
  const { data: tournaments, error: tournamentsError } = await supabase
    .from('tournaments')
    .select('slug, updated_at, is_active')
    .eq('is_active', true)
    .not('slug', 'is', null);

  if (tournamentsError) {
    console.error('Error fetching tournaments:', tournamentsError);
  } else if (tournaments) {
    console.log(`Found ${tournaments.length} tournaments for sitemap`);
    for (const tournament of tournaments) {
      if (tournament.slug) {
        urls.push({
          loc: `${baseUrl}/tournament/${tournament.slug}`,
          lastmod: tournament.updated_at ? new Date(tournament.updated_at).toISOString().split('T')[0] : undefined,
          changefreq: 'daily',
          priority: 0.8,
        });
      }
    }
  }

  // Fetch active dynamic pages
  const { data: dynamicPages, error: pagesError } = await supabase
    .from('dynamic_pages')
    .select('slug, updated_at')
    .eq('is_active', true);

  if (pagesError) {
    console.error('Error fetching dynamic pages:', pagesError);
  } else if (dynamicPages) {
    console.log(`Found ${dynamicPages.length} dynamic pages for sitemap`);
    for (const page of dynamicPages) {
      urls.push({
        loc: `${baseUrl}/page/${page.slug}`,
        lastmod: page.updated_at ? new Date(page.updated_at).toISOString().split('T')[0] : undefined,
        changefreq: 'weekly',
        priority: 0.7,
      });
    }
  }

  console.log(`Combined sitemap generated with ${urls.length} URLs`);

  return new Response(generateSitemapXml(urls), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

function generateSitemapXml(urls: SitemapUrl[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const url of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(url.loc)}</loc>\n`;
    
    if (url.lastmod) {
      xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
    }
    
    if (url.changefreq) {
      xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
    }
    
    if (url.priority !== undefined) {
      xml += `    <priority>${url.priority.toFixed(1)}</priority>\n`;
    }
    
    xml += '  </url>\n';
  }

  xml += '</urlset>';
  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
