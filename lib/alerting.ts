/**
 * Alerting utilities for critical system failures
 * Handles notifications and escalation for system issues
 */

export interface Alert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  source: string;
  timestamp: number;
  metadata?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: number;
}

export interface AlertingConfig {
  enableConsoleAlerts: boolean;
  enableWebhookAlerts: boolean;
  webhookUrl?: string;
  enableEmailAlerts: boolean;
  emailRecipients?: string[];
  rateLimitWindow: number; // milliseconds
  maxAlertsPerWindow: number;
}

/**
 * Simple alerting system with rate limiting and multiple channels
 */
export class AlertingSystem {
  private alerts: Map<string, Alert> = new Map();
  private alertCounts: Map<string, { count: number; windowStart: number }> = new Map();
  private config: AlertingConfig;

  constructor(config: Partial<AlertingConfig> = {}) {
    this.config = {
      enableConsoleAlerts: true,
      enableWebhookAlerts: false,
      enableEmailAlerts: false,
      rateLimitWindow: 300000, // 5 minutes
      maxAlertsPerWindow: 10,
      ...config
    };
  }

  /**
   * Send an alert with rate limiting
   */
  async sendAlert(
    level: Alert['level'],
    title: string,
    message: string,
    source: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    // Create alert ID based on title and source for deduplication
    const alertKey = `${source}:${title}`;
    
    // Check rate limiting
    if (!this.checkRateLimit(alertKey)) {
      console.warn(`Alert rate limited: ${alertKey}`);
      return false;
    }

    const alert: Alert = {
      id: this.generateAlertId(),
      level,
      title,
      message,
      source,
      timestamp: Date.now(),
      metadata
    };

    this.alerts.set(alert.id, alert);

    // Send through configured channels
    const results = await Promise.allSettled([
      this.sendConsoleAlert(alert),
      this.sendWebhookAlert(alert),
      this.sendEmailAlert(alert)
    ]);

    // Log any failures in alert sending
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Alert channel ${index} failed:`, result.reason);
      }
    });

    return true;
  }

  /**
   * Send critical alert (bypasses some rate limiting)
   */
  async sendCriticalAlert(
    title: string,
    message: string,
    source: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    return this.sendAlert('critical', title, message, source, metadata);
  }

  /**
   * Check rate limiting for alert key
   */
  private checkRateLimit(alertKey: string): boolean {
    const now = Date.now();
    const existing = this.alertCounts.get(alertKey);

    if (!existing || (now - existing.windowStart) > this.config.rateLimitWindow) {
      // New window
      this.alertCounts.set(alertKey, { count: 1, windowStart: now });
      return true;
    }

    if (existing.count >= this.config.maxAlertsPerWindow) {
      return false; // Rate limited
    }

    existing.count++;
    return true;
  }

  /**
   * Send alert to console
   */
  private async sendConsoleAlert(alert: Alert): Promise<void> {
    if (!this.config.enableConsoleAlerts) return;

    const emoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🚨'
    }[alert.level];

    console.log(`\n${emoji} ALERT [${alert.level.toUpperCase()}] ${emoji}`);
    console.log(`Title: ${alert.title}`);
    console.log(`Source: ${alert.source}`);
    console.log(`Message: ${alert.message}`);
    console.log(`Time: ${new Date(alert.timestamp).toISOString()}`);
    if (alert.metadata) {
      console.log(`Metadata:`, JSON.stringify(alert.metadata, null, 2));
    }
    console.log('─'.repeat(50));
  }

  /**
   * Send alert via webhook
   */
  private async sendWebhookAlert(alert: Alert): Promise<void> {
    if (!this.config.enableWebhookAlerts || !this.config.webhookUrl) return;

    const payload = {
      alert,
      timestamp: new Date().toISOString(),
      system: 'headshots-training-pipeline'
    };

    await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  }

  /**
   * Send alert via email (placeholder - would integrate with email service)
   */
  private async sendEmailAlert(alert: Alert): Promise<void> {
    if (!this.config.enableEmailAlerts || !this.config.emailRecipients?.length) return;

    // In a real implementation, integrate with SendGrid, AWS SES, etc.
    console.log(`Email alert would be sent to: ${this.config.emailRecipients.join(', ')}`);
    console.log(`Subject: [${alert.level.toUpperCase()}] ${alert.title}`);
    console.log(`Body: ${alert.message}`);
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 50): Alert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get alerts by level
   */
  getAlertsByLevel(level: Alert['level']): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.level === level)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Mark alert as resolved
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedAt = Date.now();
    return true;
  }

  /**
   * Clear old alerts (cleanup)
   */
  clearOldAlerts(maxAge: number = 86400000): number { // 24 hours default
    const cutoff = Date.now() - maxAge;
    let cleared = 0;

    for (const [id, alert] of this.alerts) {
      if (alert.timestamp < cutoff) {
        this.alerts.delete(id);
        cleared++;
      }
    }

    return cleared;
  }
}

/**
 * Predefined alert templates for common scenarios
 */
export const AlertTemplates = {
  API_FAILURE: (apiName: string, errorRate: number) => ({
    level: 'error' as const,
    title: `High Error Rate in ${apiName}`,
    message: `${apiName} API is experiencing ${errorRate.toFixed(1)}% error rate`,
    source: 'api-monitoring'
  }),

  SERVICE_DOWN: (serviceName: string) => ({
    level: 'critical' as const,
    title: `Service Unavailable: ${serviceName}`,
    message: `${serviceName} service is not responding to health checks`,
    source: 'health-monitoring'
  }),

  CIRCUIT_BREAKER_OPEN: (serviceName: string) => ({
    level: 'warning' as const,
    title: `Circuit Breaker Open: ${serviceName}`,
    message: `Circuit breaker for ${serviceName} is open due to repeated failures`,
    source: 'circuit-breaker'
  }),

  HIGH_RESPONSE_TIME: (operation: string, responseTime: number) => ({
    level: 'warning' as const,
    title: `High Response Time: ${operation}`,
    message: `${operation} is taking ${(responseTime / 1000).toFixed(1)}s to respond`,
    source: 'performance-monitoring'
  }),

  TRAINING_FAILURE: (modelName: string, error: string) => ({
    level: 'error' as const,
    title: `Training Failed: ${modelName}`,
    message: `Model training failed for ${modelName}: ${error}`,
    source: 'training-pipeline'
  }),

  UPLOAD_FAILURE_SPIKE: (failureCount: number, timeWindow: string) => ({
    level: 'warning' as const,
    title: 'Upload Failure Spike',
    message: `${failureCount} upload failures detected in the last ${timeWindow}`,
    source: 'upload-monitoring'
  })
};

// Global alerting system instance
export const globalAlerting = new AlertingSystem({
  enableConsoleAlerts: true,
  enableWebhookAlerts: process.env.ALERT_WEBHOOK_URL ? true : false,
  webhookUrl: process.env.ALERT_WEBHOOK_URL,
  enableEmailAlerts: false, // Enable when email service is configured
  rateLimitWindow: 300000, // 5 minutes
  maxAlertsPerWindow: 5
});

/**
 * Convenience functions for common alert scenarios
 */
export async function alertApiFailure(apiName: string, errorRate: number, metadata?: Record<string, any>) {
  const template = AlertTemplates.API_FAILURE(apiName, errorRate);
  return globalAlerting.sendAlert(template.level, template.title, template.message, template.source, metadata);
}

export async function alertServiceDown(serviceName: string, metadata?: Record<string, any>) {
  const template = AlertTemplates.SERVICE_DOWN(serviceName);
  return globalAlerting.sendAlert(template.level, template.title, template.message, template.source, metadata);
}

export async function alertCircuitBreakerOpen(serviceName: string, metadata?: Record<string, any>) {
  const template = AlertTemplates.CIRCUIT_BREAKER_OPEN(serviceName);
  return globalAlerting.sendAlert(template.level, template.title, template.message, template.source, metadata);
}

export async function alertHighResponseTime(operation: string, responseTime: number, metadata?: Record<string, any>) {
  const template = AlertTemplates.HIGH_RESPONSE_TIME(operation, responseTime);
  return globalAlerting.sendAlert(template.level, template.title, template.message, template.source, metadata);
}

export async function alertTrainingFailure(modelName: string, error: string, metadata?: Record<string, any>) {
  const template = AlertTemplates.TRAINING_FAILURE(modelName, error);
  return globalAlerting.sendAlert(template.level, template.title, template.message, template.source, metadata);
}