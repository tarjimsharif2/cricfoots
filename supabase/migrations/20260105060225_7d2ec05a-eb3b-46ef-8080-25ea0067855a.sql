-- Create a public view with only safe fields (no sensitive auth data)
CREATE OR REPLACE VIEW public.streaming_servers_public AS
SELECT 
  id,
  match_id,
  server_name,
  server_url,
  server_type,
  display_order,
  is_active,
  player_type,
  created_at,
  updated_at
FROM public.streaming_servers
WHERE is_active = true;

-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Streaming servers are viewable by everyone" ON public.streaming_servers;

-- Create new policy that only allows admins to view the full table
CREATE POLICY "Only admins can view streaming servers"
ON public.streaming_servers FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Grant SELECT on the public view to anonymous and authenticated users
GRANT SELECT ON public.streaming_servers_public TO anon, authenticated;