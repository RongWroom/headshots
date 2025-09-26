-- Performance Benchmarking System Migration
-- Add tables for automated performance testing, regression detection, and optimization

-- Performance benchmarks table
CREATE TABLE IF NOT EXISTS performance_benchmarks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    provider TEXT NOT NULL,
    training_config JSONB NOT NULL,
    test_images TEXT[] NOT NULL,
    expected_metrics JSONB NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Benchmark results table
CREATE TABLE IF NOT EXISTS benchmark_results (
    id TEXT PRIMARY KEY,
    benchmark_id TEXT NOT NULL REFERENCES performance_benchmarks(id) ON DELETE CASCADE,
    run_date TIMESTAMPTZ NOT NULL,
    training_time INTEGER NOT NULL, -- milliseconds
    quality_score DECIMAL(5,4) NOT NULL,
    cost DECIMAL(10,4) NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    performance_metrics JSONB NOT NULL,
    regression_detected BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Regression alerts table
CREATE TABLE IF NOT EXISTS regression_alerts (
    id TEXT PRIMARY KEY,
    benchmark_id TEXT NOT NULL REFERENCES performance_benchmarks(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL,
    current_value DECIMAL(15,6) NOT NULL,
    baseline_value DECIMAL(15,6) NOT NULL,
    regression_percentage DECIMAL(8,6) NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    detected_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    acknowledged_at TIMESTAMPTZ,
    acknowledgment_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parameter optimizations table
CREATE TABLE IF NOT EXISTS parameter_optimizations (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    optimization_target TEXT NOT NULL CHECK (optimization_target IN ('quality', 'speed', 'cost', 'balanced')),
    current_config JSONB NOT NULL,
    optimized_config JSONB NOT NULL,
    expected_improvement JSONB NOT NULL,
    confidence_score DECIMAL(4,3) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    results JSONB
);

-- Performance reports table
CREATE TABLE IF NOT EXISTS performance_reports (
    id SERIAL PRIMARY KEY,
    period TEXT NOT NULL,
    report_data JSONB NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled reports table
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id TEXT PRIMARY KEY,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    recipients TEXT[] NOT NULL,
    report_types TEXT[] NOT NULL,
    enabled BOOLEAN DEFAULT true,
    next_run TIMESTAMPTZ NOT NULL,
    last_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_benchmark_results_benchmark_id ON benchmark_results(benchmark_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_run_date ON benchmark_results(run_date DESC);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_success ON benchmark_results(success);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_regression ON benchmark_results(regression_detected);

CREATE INDEX IF NOT EXISTS idx_regression_alerts_benchmark_id ON regression_alerts(benchmark_id);
CREATE INDEX IF NOT EXISTS idx_regression_alerts_severity ON regression_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_regression_alerts_detected_at ON regression_alerts(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_regression_alerts_resolved ON regression_alerts(resolved_at);

CREATE INDEX IF NOT EXISTS idx_parameter_optimizations_provider ON parameter_optimizations(provider);
CREATE INDEX IF NOT EXISTS idx_parameter_optimizations_target ON parameter_optimizations(optimization_target);
CREATE INDEX IF NOT EXISTS idx_parameter_optimizations_applied ON parameter_optimizations(applied_at);

CREATE INDEX IF NOT EXISTS idx_performance_reports_period ON performance_reports(period);
CREATE INDEX IF NOT EXISTS idx_performance_reports_generated_at ON performance_reports(generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_enabled ON scheduled_reports(enabled);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_performance_benchmarks_updated_at 
    BEFORE UPDATE ON performance_benchmarks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regression_alerts_updated_at 
    BEFORE UPDATE ON regression_alerts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at 
    BEFORE UPDATE ON scheduled_reports 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for benchmark performance summary
CREATE OR REPLACE VIEW benchmark_performance_summary AS
SELECT 
    pb.id,
    pb.name,
    pb.provider,
    COUNT(br.id) as total_runs,
    COUNT(CASE WHEN br.success THEN 1 END) as successful_runs,
    ROUND(AVG(CASE WHEN br.success THEN br.training_time END)::numeric, 0) as avg_training_time,
    ROUND(AVG(CASE WHEN br.success THEN br.quality_score END)::numeric, 4) as avg_quality_score,
    ROUND(AVG(CASE WHEN br.success THEN br.cost END)::numeric, 4) as avg_cost,
    COUNT(CASE WHEN br.regression_detected THEN 1 END) as regression_count,
    MAX(br.run_date) as last_run_date
FROM performance_benchmarks pb
LEFT JOIN benchmark_results br ON pb.id = br.benchmark_id
WHERE pb.active = true
GROUP BY pb.id, pb.name, pb.provider;

-- Create view for active regression alerts summary
CREATE OR REPLACE VIEW active_regression_alerts_summary AS
SELECT 
    severity,
    COUNT(*) as alert_count,
    COUNT(CASE WHEN acknowledged_at IS NOT NULL THEN 1 END) as acknowledged_count,
    MIN(detected_at) as oldest_alert,
    MAX(detected_at) as newest_alert
FROM regression_alerts
WHERE resolved_at IS NULL
GROUP BY severity
ORDER BY 
    CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
    END;

-- Create view for provider performance comparison
CREATE OR REPLACE VIEW provider_performance_comparison AS
SELECT 
    pb.provider,
    COUNT(br.id) as total_runs,
    COUNT(CASE WHEN br.success THEN 1 END) as successful_runs,
    ROUND((COUNT(CASE WHEN br.success THEN 1 END)::decimal / NULLIF(COUNT(br.id), 0) * 100), 2) as success_rate,
    ROUND(AVG(CASE WHEN br.success THEN br.training_time END)::numeric, 0) as avg_training_time,
    ROUND(AVG(CASE WHEN br.success THEN br.quality_score END)::numeric, 4) as avg_quality_score,
    ROUND(AVG(CASE WHEN br.success THEN br.cost END)::numeric, 4) as avg_cost,
    COUNT(CASE WHEN br.regression_detected THEN 1 END) as regression_count
FROM performance_benchmarks pb
LEFT JOIN benchmark_results br ON pb.id = br.benchmark_id
WHERE pb.active = true
    AND br.run_date >= NOW() - INTERVAL '30 days'
GROUP BY pb.provider
ORDER BY success_rate DESC, avg_quality_score DESC;

-- Insert sample benchmark data for testing
INSERT INTO performance_benchmarks (id, name, description, provider, training_config, test_images, expected_metrics) VALUES
(
    'bench_runpod_standard',
    'RunPod Standard Configuration',
    'Standard FLUX LoRA training configuration for RunPod',
    'runpod',
    '{
        "resolution": 1024,
        "max_train_steps": 1500,
        "lora_rank": 64,
        "learning_rate": 0.0001,
        "train_batch_size": 2,
        "gradient_accumulation": 4,
        "mixed_precision": "fp16",
        "use_xformers": true
    }',
    ARRAY[
        'https://example.com/test1.jpg',
        'https://example.com/test2.jpg',
        'https://example.com/test3.jpg',
        'https://example.com/test4.jpg',
        'https://example.com/test5.jpg'
    ],
    '{
        "max_training_time": 1800000,
        "min_quality_score": 0.85,
        "max_cost": 3.0,
        "min_success_rate": 0.95
    }'
),
(
    'bench_fal_optimized',
    'Fal.ai Optimized Configuration',
    'Optimized FLUX LoRA training configuration for Fal.ai',
    'fal',
    '{
        "resolution": 1024,
        "max_train_steps": 1200,
        "lora_rank": 64,
        "learning_rate": 0.0001,
        "train_batch_size": 3,
        "gradient_accumulation": 2,
        "mixed_precision": "bf16",
        "use_xformers": true
    }',
    ARRAY[
        'https://example.com/test1.jpg',
        'https://example.com/test2.jpg',
        'https://example.com/test3.jpg',
        'https://example.com/test4.jpg',
        'https://example.com/test5.jpg'
    ],
    '{
        "max_training_time": 1200000,
        "min_quality_score": 0.83,
        "max_cost": 2.5,
        "min_success_rate": 0.93
    }'
);

-- Grant permissions for service role
GRANT ALL ON performance_benchmarks TO service_role;
GRANT ALL ON benchmark_results TO service_role;
GRANT ALL ON regression_alerts TO service_role;
GRANT ALL ON parameter_optimizations TO service_role;
GRANT ALL ON performance_reports TO service_role;
GRANT ALL ON scheduled_reports TO service_role;

-- Grant read permissions for authenticated users on summary views
GRANT SELECT ON benchmark_performance_summary TO authenticated;
GRANT SELECT ON active_regression_alerts_summary TO authenticated;
GRANT SELECT ON provider_performance_comparison TO authenticated;

-- Add RLS policies
ALTER TABLE performance_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE regression_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameter_optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Service role can access all data
CREATE POLICY "Service role can manage performance benchmarks" ON performance_benchmarks FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can manage benchmark results" ON benchmark_results FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can manage regression alerts" ON regression_alerts FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can manage parameter optimizations" ON parameter_optimizations FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can manage performance reports" ON performance_reports FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can manage scheduled reports" ON scheduled_reports FOR ALL TO service_role USING (true);

-- Authenticated users can read performance data
CREATE POLICY "Authenticated users can read performance benchmarks" ON performance_benchmarks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read benchmark results" ON benchmark_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read regression alerts" ON regression_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read parameter optimizations" ON parameter_optimizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read performance reports" ON performance_reports FOR SELECT TO authenticated USING (true);