import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const serverId = url.searchParams.get('serverId');

    if (!serverId) {
      return new Response(JSON.stringify({ error: 'Server ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role to access full table
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch the full server details including sensitive headers
    const { data: server, error } = await supabase
      .from('streaming_servers')
      .select('*')
      .eq('id', serverId)
      .eq('is_active', true)
      .single();

    if (error || !server) {
      console.error('Server not found:', error);
      return new Response(JSON.stringify({ error: 'Server not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For iframe or embed types, return the URL directly
    if (server.server_type === 'iframe' || server.server_type === 'embed') {
      return new Response(JSON.stringify({ 
        url: server.server_url,
        type: server.server_type,
        playerType: server.player_type,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For m3u8 or iframe_to_m3u8, build the proxied URL with embedded headers
    const proxyBaseUrl = `${supabaseUrl}/functions/v1/stream-proxy`;
    const params = new URLSearchParams();
    params.set('url', server.server_url);
    
    if (server.referer_value) params.set('referer', server.referer_value);
    if (server.origin_value) params.set('origin', server.origin_value);
    if (server.user_agent) params.set('userAgent', server.user_agent);
    if (server.cookie_value) params.set('cookie', server.cookie_value);

    const proxiedUrl = `${proxyBaseUrl}?${params.toString()}`;

    return new Response(JSON.stringify({ 
      url: proxiedUrl,
      originalUrl: server.server_url,
      type: server.server_type,
      playerType: server.player_type,
      drmScheme: server.drm_scheme,
      drmLicenseUrl: server.drm_license_url,
      clearkeyKeyId: server.clearkey_key_id,
      clearkeyKey: server.clearkey_key,
      hasHeaders: !!(server.referer_value || server.origin_value || server.user_agent || server.cookie_value),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-stream-url:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
