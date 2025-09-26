/**
 * Budget Alerts Management API
 * Handles budget alert creation, updates, and monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { costTrackingService, BudgetAlert } from '@/lib/cost-tracking';
import { Logger } from '@/lib/logger';

const logger = new Logger('BUDGET_ALERTS_API');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { userId, alertType, thresholdAmount, currency = 'USD', isActive = true } = body;
    
    if (!userId || !alertType || !thresholdAmount) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          required: ['userId', 'alertType', 'thresholdAmount']
        },
        { status: 400 }
      );
    }

    // Validate alert type
    const validAlertTypes = ['daily', 'weekly', 'monthly', 'per_training'];
    if (!validAlertTypes.includes(alertType)) {
      return NextResponse.json(
        { 
          error: 'Invalid alert type',
          validTypes: validAlertTypes
        },
        { status: 400 }
      );
    }

    // Validate threshold amount
    if (thresholdAmount <= 0 || thresholdAmount > 10000) {
      return NextResponse.json(
        { error: 'Threshold amount must be between $0.01 and $10,000' },
        { status: 400 }
      );
    }

    // Validate email if provided
    const { notificationEmail, notificationWebhook } = body;
    if (notificationEmail && !isValidEmail(notificationEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address format' },
        { status: 400 }
      );
    }

    // Create budget alert
    const alertData: Omit<BudgetAlert, 'id'> = {
      userId,
      alertType,
      thresholdAmount,
      currency,
      isActive,
      notificationEmail,
      notificationWebhook
    };

    logger.logInfo('BUDGET_ALERT_CREATE', {
      userId,
      alertType,
      thresholdAmount
    });

    const budgetAlert = await costTrackingService.setBudgetAlert(alertData);

    logger.logSuccess('BUDGET_ALERT_CREATED', {
      alertId: budgetAlert.id,
      userId,
      alertType
    });

    return NextResponse.json({
      success: true,
      alert: budgetAlert
    });

  } catch (error: any) {
    logger.logError('BUDGET_ALERT_CREATE_FAILED', {
      error: error.message,
      stack: error.stack
    });

    return NextResponse.json(
      { 
        error: 'Failed to create budget alert',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    // Get user's budget status
    const budgetStatuses = await costTrackingService.getBudgetStatus(userId);

    // Get user's active alerts
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: alerts, error } = await supabase
      .from('budget_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch budget alerts: ${error.message}`);
    }

    // Get recent alert notifications
    const { data: notifications, error: notificationsError } = await supabase
      .from('budget_alert_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (notificationsError) {
      logger.logWarning('BUDGET_NOTIFICATIONS_FETCH_FAILED', 'Failed to fetch budget notifications', {
        error: notificationsError.message,
        userId
      });
    }

    logger.logInfo('BUDGET_STATUS_RETRIEVED', {
      userId,
      alertsCount: alerts.length,
      activeAlerts: alerts.filter(a => a.is_active).length
    });

    return NextResponse.json({
      success: true,
      budgetStatuses,
      alerts: alerts.map(alert => ({
        id: alert.id,
        alertType: alert.alert_type,
        thresholdAmount: alert.threshold_amount,
        currency: alert.currency,
        isActive: alert.is_active,
        notificationEmail: alert.notification_email,
        notificationWebhook: alert.notification_webhook,
        createdAt: alert.created_at,
        lastTriggered: alert.last_triggered
      })),
      recentNotifications: notifications?.map(notification => ({
        id: notification.id,
        triggeredAmount: notification.triggered_amount,
        periodStart: notification.period_start,
        periodEnd: notification.period_end,
        notificationSent: notification.notification_sent,
        createdAt: notification.created_at
      })) || []
    });

  } catch (error: any) {
    logger.logError('BUDGET_STATUS_FETCH_FAILED', {
      error: error.message
    });

    return NextResponse.json(
      { 
        error: 'Failed to fetch budget status',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId, isActive, thresholdAmount, notificationEmail, notificationWebhook } = body;

    if (!alertId) {
      return NextResponse.json(
        { error: 'alertId is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build update object
    const updateData: any = {};
    if (typeof isActive === 'boolean') updateData.is_active = isActive;
    if (thresholdAmount !== undefined) updateData.threshold_amount = thresholdAmount;
    if (notificationEmail !== undefined) updateData.notification_email = notificationEmail;
    if (notificationWebhook !== undefined) updateData.notification_webhook = notificationWebhook;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('budget_alerts')
      .update(updateData)
      .eq('id', alertId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update budget alert: ${error.message}`);
    }

    logger.logSuccess('BUDGET_ALERT_UPDATED', {
      alertId,
      updates: Object.keys(updateData)
    });

    return NextResponse.json({
      success: true,
      alert: {
        id: data.id,
        alertType: data.alert_type,
        thresholdAmount: data.threshold_amount,
        currency: data.currency,
        isActive: data.is_active,
        notificationEmail: data.notification_email,
        notificationWebhook: data.notification_webhook,
        updatedAt: data.updated_at
      }
    });

  } catch (error: any) {
    logger.logError('BUDGET_ALERT_UPDATE_FAILED', {
      error: error.message
    });

    return NextResponse.json(
      { 
        error: 'Failed to update budget alert',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get('alertId');

    if (!alertId) {
      return NextResponse.json(
        { error: 'alertId parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('budget_alerts')
      .delete()
      .eq('id', alertId);

    if (error) {
      throw new Error(`Failed to delete budget alert: ${error.message}`);
    }

    logger.logSuccess('BUDGET_ALERT_DELETED', { alertId });

    return NextResponse.json({
      success: true,
      message: 'Budget alert deleted successfully'
    });

  } catch (error: any) {
    logger.logError('BUDGET_ALERT_DELETE_FAILED', {
      error: error.message
    });

    return NextResponse.json(
      { 
        error: 'Failed to delete budget alert',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

/**
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}