import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IndexingRequest {
  url: string;
  type: 'URL_UPDATED' | 'URL_DELETED';
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);
  
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  
  const base64UrlEncode = (data: Uint8Array): string => {
    return btoa(String.fromCharCode(...data))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const claimB64 = base64UrlEncode(encoder.encode(JSON.stringify(claim)));
  const signatureInput = `${headerB64}.${claimB64}`;

  // Import the private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  const jwt = `${signatureInput}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('Token exchange failed:', error);
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function submitUrlToIndexing(url: string, type: string, accessToken: string): Promise<any> {
  console.log(`Submitting URL to Google Indexing API: ${url} (${type})`);
  
  const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      url: url,
      type: type,
    }),
  });

  const result = await response.json();
  
  if (!response.ok) {
    console.error('Indexing API error:', result);
    throw new Error(`Indexing API error: ${JSON.stringify(result)}`);
  }

  console.log('Indexing API response:', result);
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountJson = Deno.env.get('GOOGLE_INDEXING_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      throw new Error('GOOGLE_INDEXING_SERVICE_ACCOUNT not configured');
    }

    const { urls, matchId, action = 'URL_UPDATED' } = await req.json();
    
    // Get access token
    const accessToken = await getAccessToken(serviceAccountJson);
    
    const results: any[] = [];
    const urlsToSubmit: string[] = urls || [];
    
    // If matchId provided, fetch the match and build URL
    if (matchId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: match, error } = await supabase
        .from('matches')
        .select('slug')
        .eq('id', matchId)
        .single();
      
      if (error) {
        console.error('Error fetching match:', error);
        throw new Error(`Failed to fetch match: ${error.message}`);
      }
      
      if (match?.slug) {
        // Get site settings for canonical URL
        const { data: settings } = await supabase
          .from('site_settings_public')
          .select('canonical_url')
          .limit(1)
          .single();
        
        const baseUrl = settings?.canonical_url || 'https://your-domain.com';
        const matchUrl = `${baseUrl}/match/${match.slug}`;
        urlsToSubmit.push(matchUrl);
      }
    }

    if (urlsToSubmit.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No URLs to submit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Submit each URL
    for (const url of urlsToSubmit) {
      try {
        const result = await submitUrlToIndexing(url, action, accessToken);
        results.push({ url, success: true, result });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to submit ${url}:`, error);
        results.push({ url, success: false, error: errorMessage });
      }
    }

    console.log(`Indexing complete. Submitted ${results.length} URLs.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        submitted: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Google Indexing error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
