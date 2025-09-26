import { NextRequest, NextResponse } from 'next/server';
import { performanceBenchmarkingService } from '@/lib/training-performance-benchmarking';

/**
 * GET /api/training/performance-reports
 * Generate performance comparison reports
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Default to last 30 days if dates not provided
    const defaultEndDate = new Date().toISOString().split('T')[0];
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const reportStartDate = startDate || defaultStartDate;
    const reportEndDate = endDate || defaultEndDate;

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(reportStartDate) || !dateRegex.test(reportEndDate)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid date format. Use YYYY-MM-DD format' 
        },
        { status: 400 }
      );
    }

    // Validate date range
    if (new Date(reportStartDate) > new Date(reportEndDate)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Start date must be before end date' 
        },
        { status: 400 }
      );
    }

    // Generate performance report
    const report = await performanceBenchmarkingService.generatePerformanceReport(
      reportStartDate,
      reportEndDate
    );

    return NextResponse.json({
      success: true,
      data: report,
      message: `Performance report generated for period ${reportStartDate} to ${reportEndDate}`
    });

  } catch (error) {
    console.error('Performance report error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate performance report'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/training/performance-reports
 * Schedule automated performance reports
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      frequency, 
      recipients, 
      reportTypes, 
      enabled = true 
    } = body;

    // Validate frequency
    const validFrequencies = ['daily', 'weekly', 'monthly'];
    if (!frequency || !validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Validate recipients
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Recipients array is required and must not be empty' 
        },
        { status: 400 }
      );
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid email addresses: ${invalidEmails.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Validate report types
    const validReportTypes = ['provider_comparison', 'configuration_analysis', 'trend_analysis', 'regression_alerts'];
    if (reportTypes && !Array.isArray(reportTypes)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'reportTypes must be an array' 
        },
        { status: 400 }
      );
    }

    const invalidTypes = reportTypes?.filter(type => !validReportTypes.includes(type)) || [];
    if (invalidTypes.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid report types: ${invalidTypes.join(', ')}. Valid types: ${validReportTypes.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Create scheduled report configuration
    const scheduledReport = {
      id: `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      frequency,
      recipients,
      reportTypes: reportTypes || validReportTypes,
      enabled,
      created_at: new Date().toISOString(),
      next_run: calculateNextRun(frequency)
    };

    // In a real implementation, this would be stored in the database
    // and a cron job or scheduler would process these configurations

    return NextResponse.json({
      success: true,
      data: scheduledReport,
      message: `Scheduled ${frequency} performance reports for ${recipients.length} recipients`
    });

  } catch (error) {
    console.error('Schedule report error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule performance reports'
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate next run time based on frequency
 */
function calculateNextRun(frequency: string): string {
  const now = new Date();
  
  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0); // 9 AM next day
      break;
    case 'weekly':
      now.setDate(now.getDate() + (7 - now.getDay() + 1)); // Next Monday
      now.setHours(9, 0, 0, 0);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1, 1); // First day of next month
      now.setHours(9, 0, 0, 0);
      break;
    default:
      now.setDate(now.getDate() + 1);
  }
  
  return now.toISOString();
}