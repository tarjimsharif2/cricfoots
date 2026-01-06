import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Verify admin authentication from request
 * Returns the user if authenticated and admin, null otherwise
 */
export async function verifyAdminAuth(req: Request): Promise<{ user: any; error: string | null }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Get Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Missing authentication' };
  }

  const token = authHeader.replace('Bearer ', '');

  // Create client with user's token to validate
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  // Validate token and get claims
  const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
  
  if (claimsError || !claimsData?.claims) {
    console.error('Invalid token:', claimsError);
    return { user: null, error: 'Invalid token' };
  }

  const userId = claimsData.claims.sub;
  if (!userId) {
    return { user: null, error: 'Invalid token - no user ID' };
  }

  // Use service role to check admin status
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  if (rolesError) {
    console.error('Error checking admin role:', rolesError);
    return { user: null, error: 'Failed to verify admin status' };
  }

  if (!roles) {
    return { user: null, error: 'Admin access required' };
  }

  return { user: { id: userId, ...claimsData.claims }, error: null };
}

/**
 * Create an unauthorized response with CORS headers
 */
export function unauthorizedResponse(error: string, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ success: false, error }),
    { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Create a forbidden response with CORS headers
 */
export function forbiddenResponse(error: string, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ success: false, error }),
    { 
      status: 403, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
