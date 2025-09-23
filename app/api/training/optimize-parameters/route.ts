import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Logger, extractErrorDetails } from '@/lib/logger';
import { ParameterOptimizationService } from '@/lib/parameter-optimization';
import { z } from 'zod';

export const dynamic = "force-dynamic";

const optimizeParametersSchema = z.object({
  imageUrls: z.array(z.string().url()).min(1, "At least one image is required"),
  packSlug: z.enum(["actor-headshots", "corporate-headshots", "creative-headshots"]).optional(),
  userPreference: z.enum(["speed", "quality", "balanced"]).optional(),
  qualityPreset: z.enum(["basic", "standard", "high", "premium"]).optional(),
  enableABTesting: z.boolean().default(false)
});

export async function POST(req: Request) {
  const logger = new Logger('PARAMETER_OPTIMIZATION_API');
  
  // Create a response object for auth cookies
  const authResponse = new NextResponse();
  
  logger.logInfo('PARAMETER_OPTIMIZATION_REQUEST_START', {
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  // Create Supabase client with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.headers.get('cookie')?.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1];
        },
        set(name: string, value: string, options: any) {
          authResponse.cookies.set(name, value, options);
        },
        remove(name: string, options: any) {
          authResponse.cookies.set(name, '', options);
        },
      },
    }
  );
  
  try {
    // Authentication check
    logger.logInfo('AUTH_CHECK_START');
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      const errorResponse = logger.createErrorResponse(
        'Authentication failed',
        'Please sign in to access parameter optimization',
        'UNAUTHORIZED',
        { authError: error ? extractErrorDetails(error) : 'No user found' },
        ['Sign in to your account', 'Check if your session has expired']
      );
      
      logger.logError('AUTH_FAILED', error || 'No user found');
      
      return NextResponse.json(errorResponse, { 
        status: 401,
        headers: authResponse.headers
      });
    }

    const userId = user.id;
    logger.setUserId(userId);
    logger.logSuccess('AUTH_SUCCESS', { userId, userEmail: user.email });

    // Parse and validate request
    logger.logInfo('REQUEST_PARSING_START');
    
    let requestData;
    try {
      requestData = await req.json();
      logger.logSuccess('REQUEST_PARSED', { 
        dataKeys: Object.keys(requestData),
        imageCount: requestData.imageUrls?.length,
        packSlug: requestData.packSlug,
        userPreference: requestData.userPreference
      });
    } catch (parseError) {
      const errorResponse = logger.createErrorResponse(
        'Invalid JSON',
        'Request body contains invalid JSON',
        'INVALID_JSON',
        { parseError: extractErrorDetails(parseError) },
        ['Check that the request body is valid JSON']
      );
      
      logger.logError('JSON_PARSE_FAILED', parseError);
      
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: authResponse.headers
      });
    }
    
    // Validate request schema
    logger.logInfo('SCHEMA_VALIDATION_START');
    const validation = optimizeParametersSchema.safeParse(requestData);
    
    if (!validation.success) {
      const errorResponse = logger.createErrorResponse(
        'Validation failed',
        'Request data does not match required schema',
        'VALIDATION_ERROR',
        { 
          validationErrors: validation.error.issues,
          receivedData: requestData
        },
        [
          'Check that all required fields are present',
          'Verify imageUrls is an array of valid URLs',
          'Ensure userPreference is one of: speed, quality, balanced'
        ]
      );
      
      logger.logError('SCHEMA_VALIDATION_FAILED', validation.error);
      
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: authResponse.headers
      });
    }

    const { imageUrls, packSlug, userPreference, qualityPreset, enableABTesting } = validation.data;
    logger.logSuccess('SCHEMA_VALIDATION_SUCCESS', {
      imageCount: imageUrls.length,
      packSlug,
      userPreference,
      qualityPreset,
      enableABTesting
    });

    // Optimize parameters
    logger.logInfo('PARAMETER_OPTIMIZATION_START');
    const parameterOptimizer = new ParameterOptimizationService();
    
    const optimizationResult = await parameterOptimizer.optimizeParameters({
      imageUrls,
      packSlug,
      userPreference,
      userId,
      qualityPreset,
      enableABTesting
    });

    logger.logSuccess('PARAMETER_OPTIMIZATION_COMPLETE', {
      selectedPreset: optimizationResult.parameterSet.name,
      qualityLevel: optimizationResult.parameterSet.qualityLevel,
      estimatedTime: optimizationResult.costEstimate.estimatedMinutes,
      estimatedCost: optimizationResult.costEstimate.estimatedCost,
      abTestParticipant: !!optimizationResult.abTestInfo,
      validationErrors: optimizationResult.validation.errors.length,
      validationWarnings: optimizationResult.validation.warnings.length,
      recommendationCount: optimizationResult.recommendations.length
    });

    // Success response
    const successResponse = {
      success: true,
      message: 'Parameters optimized successfully',
      optimization: {
        selectedParameters: optimizationResult.selectedParameters,
        parameterSet: {
          name: optimizationResult.parameterSet.name,
          description: optimizationResult.parameterSet.description,
          qualityLevel: optimizationResult.parameterSet.qualityLevel,
          estimatedTime: optimizationResult.parameterSet.estimatedTime,
          recommendedFor: optimizationResult.parameterSet.recommendedFor
        },
        qualityAssessment: optimizationResult.qualityAssessment,
        costEstimate: optimizationResult.costEstimate,
        validation: {
          isValid: optimizationResult.validation.isValid,
          warnings: optimizationResult.validation.warnings,
          errors: optimizationResult.validation.errors
        },
        recommendations: optimizationResult.recommendations,
        abTestInfo: optimizationResult.abTestInfo
      }
    };

    logger.logSuccess('PARAMETER_OPTIMIZATION_SUCCESS', {
      userId,
      imageCount: imageUrls.length,
      selectedPreset: optimizationResult.parameterSet.name
    });

    const response = NextResponse.json(successResponse);
    
    // Copy auth cookies to the success response
    for (const [key, value] of authResponse.headers.entries()) {
      response.headers.set(key, value);
    }

    return response;

  } catch (error) {
    const errorResponse = logger.createErrorResponse(
      'Parameter optimization failed',
      'An unexpected error occurred while optimizing parameters',
      'OPTIMIZATION_ERROR',
      { 
        error: extractErrorDetails(error),
        timestamp: new Date().toISOString()
      },
      [
        'Check your internet connection',
        'Verify all image URLs are accessible',
        'Try again in a few moments',
        'Contact support if the issue persists'
      ]
    );
    
    logger.logError('PARAMETER_OPTIMIZATION_ERROR', error);
    
    const response = NextResponse.json(errorResponse, { status: 500 });

    // Copy auth cookies to the error response
    for (const [key, value] of authResponse.headers.entries()) {
      response.headers.set(key, value);
    }

    return response;
  }
}