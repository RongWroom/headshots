import { NextRequest, NextResponse } from 'next/server';
import { QualityMonitoringService, DEFAULT_MONITORING_CONFIG } from '@/lib/quality-monitoring';

export async function POST(request: NextRequest) {
  try {
    const { modelId, config = DEFAULT_MONITORING_CONFIG } = await request.json();

    if (!modelId) {
      return NextResponse.json(
        { error: 'Missing required parameter: modelId' },
        { status: 400 }
      );
    }

    const monitoringService = new QualityMonitoringService();
    const alerts = await monitoringService.monitorModelQuality(modelId, config);

    return NextResponse.json({
      success: true,
      modelId,
      alerts,
      alertCount: alerts.length,
    });
  } catch (error) {
    console.error('Quality monitoring error:', error);
    return NextResponse.json(
      { error: 'Failed to monitor model quality', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const dashboard = searchParams.get('dashboard') === 'true';

    const monitoringService = new QualityMonitoringService();

    if (dashboard) {
      // Return dashboard data
      const dashboardData = await monitoringService.getMonitoringDashboard();
      return NextResponse.json({
        success: true,
        dashboard: dashboardData,
      });
    }

    if (!modelId) {
      return NextResponse.json(
        { error: 'Missing required parameter: modelId (or use dashboard=true for dashboard data)' },
        { status: 400 }
      );
    }

    // Return active alerts for specific model
    const alerts = await monitoringService.getActiveAlerts(modelId);

    return NextResponse.json({
      success: true,
      modelId,
      alerts,
      alertCount: alerts.length,
    });
  } catch (error) {
    console.error('Quality monitoring retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve quality monitoring data', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { alertId, action } = await request.json();

    if (!alertId || !action) {
      return NextResponse.json(
        { error: 'Missing required parameters: alertId and action' },
        { status: 400 }
      );
    }

    if (action !== 'resolve') {
      return NextResponse.json(
        { error: 'Invalid action. Only "resolve" is supported' },
        { status: 400 }
      );
    }

    const monitoringService = new QualityMonitoringService();
    await monitoringService.resolveAlert(alertId);

    return NextResponse.json({
      success: true,
      message: 'Alert resolved successfully',
      alertId,
    });
  } catch (error) {
    console.error('Alert resolution error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve alert', details: error.message },
      { status: 500 }
    );
  }
}