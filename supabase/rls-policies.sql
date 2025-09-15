-- =====================================================
-- ADDITIONAL ROW LEVEL SECURITY POLICIES
-- =====================================================
-- Note: Basic RLS policies are already included in the main migration file.
-- This file contains additional or supplementary policies if needed.

-- Additional service role policies for comprehensive access
-- These complement the policies in the migration file

-- =====================================================
-- ADDITIONAL MODELS TABLE POLICIES
-- =====================================================

-- Allow service role to insert models (for webhook operations)
CREATE POLICY "Service role can insert models" 
  ON public.models FOR INSERT 
  TO service_role
  WITH CHECK (true);

-- Allow service role to read all models
CREATE POLICY "Service role can read all models" 
  ON public.models FOR SELECT 
  TO service_role
  USING (true);

-- =====================================================
-- ADDITIONAL SAMPLES TABLE POLICIES
-- =====================================================

-- Allow service role to insert samples (for webhook operations)
CREATE POLICY "Service role can insert samples" 
  ON public.samples FOR INSERT 
  TO service_role
  WITH CHECK (true);

-- Allow service role to read all samples
CREATE POLICY "Service role can read all samples" 
  ON public.samples FOR SELECT 
  TO service_role
  USING (true);

-- Allow service role to update samples
CREATE POLICY "Service role can update samples" 
  ON public.samples FOR UPDATE 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service role to delete samples
CREATE POLICY "Service role can delete samples" 
  ON public.samples FOR DELETE 
  TO service_role
  USING (true);

-- =====================================================
-- ADDITIONAL IMAGES TABLE POLICIES
-- =====================================================

-- Allow service role to update images
CREATE POLICY "Service role can update images" 
  ON public.images FOR UPDATE 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service role to delete images
CREATE POLICY "Service role can delete images" 
  ON public.images FOR DELETE 
  TO service_role
  USING (true);

-- Allow service role to read all images
CREATE POLICY "Service role can read all images" 
  ON public.images FOR SELECT 
  TO service_role
  USING (true);
