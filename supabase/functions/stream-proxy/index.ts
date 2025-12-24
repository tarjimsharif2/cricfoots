import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, headers } = await req.json();

    if (!url) {
      console.error('No URL provided');
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Proxying request to:', url);
    console.log('Custom headers:', headers);

    // Build request headers
    const requestHeaders: HeadersInit = {
      'Accept': '*/*',
    };

    if (headers?.referer) {
      requestHeaders['Referer'] = headers.referer;
      console.log('Setting Referer:', headers.referer);
    }

    if (headers?.origin) {
      requestHeaders['Origin'] = headers.origin;
      console.log('Setting Origin:', headers.origin);
    }

    if (headers?.cookie) {
      requestHeaders['Cookie'] = headers.cookie;
      console.log('Setting Cookie:', headers.cookie);
    }

    if (headers?.userAgent) {
      requestHeaders['User-Agent'] = headers.userAgent;
      console.log('Setting User-Agent:', headers.userAgent);
    } else {
      // Default user agent
      requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    // Fetch the stream
    const response = await fetch(url, {
      method: 'GET',
      headers: requestHeaders,
    });

    if (!response.ok) {
      console.error('Upstream error:', response.status, response.statusText);
      return new Response(JSON.stringify({ 
        error: `Upstream error: ${response.status} ${response.statusText}` 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';
    const content = await response.text();

    console.log('Successfully fetched content, length:', content.length);

    // For M3U8 playlists, we need to rewrite relative URLs to absolute URLs
    let processedContent = content;
    
    if (url.endsWith('.m3u8') || contentType.includes('mpegurl') || contentType.includes('x-mpegURL')) {
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      
      // Rewrite relative URLs in the playlist
      processedContent = content.split('\n').map(line => {
        const trimmedLine = line.trim();
        
        // Skip empty lines, comments, and tags
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          return line;
        }
        
        // If it's already an absolute URL, leave it
        if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
          return line;
        }
        
        // Convert relative URL to absolute
        return baseUrl + trimmedLine;
      }).join('\n');
    }

    return new Response(processedContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in stream-proxy function:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});